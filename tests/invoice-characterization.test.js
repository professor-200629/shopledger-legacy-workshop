var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

// Invoice expectations match the characterized checkout bill and HSN breakdown.
// Read real saved orders without calling the store's write methods.
var fixture = fs.readFileSync(path.join(__dirname, '..', 'data', 'db.json'), 'utf8');
var cases = [
  {
    id: 1002,
    description: 'SAVE10 on rice and sunflower oil',
    coupon: 'SAVE10',
    checkout: { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 },
    checkoutLines: [
      { hsn: '1006', gstPercent: 5, tax: 28.8 },
      { hsn: '1512', gstPercent: 5, tax: 17.1 }
    ],
    printed: { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 },
    invoiceLines: [
      { hsn: '1006', gstPercent: 5, tax: 28.8 },
      { hsn: '1512', gstPercent: 5, tax: 17.1 }
    ]
  },
  {
    id: 1004,
    description: 'SAVE10 capped at checkout on groundnut oil',
    coupon: 'SAVE10',
    checkout: { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 },
    checkoutLines: [{ hsn: '1508', gstPercent: 5, tax: 104.5 }],
    printed: { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 },
    invoiceLines: [{ hsn: '1508', gstPercent: 5, tax: 104.5 }]
  },
  {
    id: 1001,
    description: 'no coupon on tea and dal',
    coupon: '',
    checkout: { subtotal: 610, discount: 0, tax: 66.9, cgst: 33.45, sgst: 33.45, total: 676.9 },
    checkoutLines: [
      { hsn: '0902', gstPercent: 18, tax: 50.4 },
      { hsn: '0713', gstPercent: 5, tax: 16.5 }
    ],
    printed: { subtotal: 610, discount: 0, tax: 66.9, cgst: 33.45, sgst: 33.45, total: 676.9 },
    invoiceLines: [
      { hsn: '0902', gstPercent: 18, tax: 50.4 },
      { hsn: '0713', gstPercent: 5, tax: 16.5 }
    ]
  }
];

function savedOrder(id) {
  var order = JSON.parse(fixture).orders.find(function (entry) { return entry.id === id; });
  assert.ok(order, 'Real data must contain order #' + id);
  return order;
}

function figures(value) {
  return {
    subtotal: value.subtotal,
    discount: value.discount,
    tax: value.tax,
    cgst: value.cgst,
    sgst: value.sgst,
    total: value.total
  };
}

cases.forEach(function (example) {
  var label = 'Order #' + example.id + ' (' + example.description + ')';

  test(label + ': checkout matches the saved bill and current GST breakdown', function () {
    var order = savedOrder(example.id);
    assert.equal(order.coupon, example.coupon);
    var totals = pricing.computeTotals(order.items, order.coupon);
    assert.deepStrictEqual(figures(totals), example.checkout);
    ['subtotal', 'discount', 'tax', 'total'].forEach(function (key) {
      assert.equal(order[key], example.checkout[key], 'Saved ' + key);
    });
    assert.deepStrictEqual(totals.lines.map(function (line) {
      return { hsn: line.hsn, gstPercent: line.gstPercent, tax: line.tax };
    }), example.checkoutLines);
  });

  test(label + ': invoice matches checkout totals and per-item GST', function () {
    var order = savedOrder(example.id);
    var calculated = invoice.computeInvoiceFigures(order);
    assert.deepStrictEqual(figures(calculated), example.printed);
    assert.deepStrictEqual(calculated.rows.map(function (row) {
      return { hsn: row.hsn, gstPercent: row.gstPercent, tax: row.lineTax };
    }), example.invoiceLines);
    assert.equal(calculated.total, order.total, 'Invoice matches billed total');
    assert.equal(calculated.tax, order.tax, 'Invoice matches billed GST');
  });

  test(label + ': printable HTML shows billed amounts without a mismatch notice', function () {
    var html = invoice.render(savedOrder(example.id));
    assert.ok(html.includes('Gross Subtotal</td><td class="r">₹' + example.printed.subtotal.toFixed(2) + '</td>'));
    assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹' + example.printed.tax.toFixed(2) + '</td>'));
    assert.ok(html.includes('Invoice Total</td><td class="r">₹' + example.printed.total.toFixed(2) + '</td>'));
    if (example.coupon) {
      assert.ok(html.includes('Coupon Discount (' + example.coupon + ')</td><td class="r" style="color:#16a34a">-₹' + example.printed.discount.toFixed(2) + '</td>'));
    } else {
      assert.ok(!html.includes('Coupon Discount ('), 'No discount row without a coupon');
    }
    example.invoiceLines.forEach(function (line) {
      assert.ok(html.includes('<td class="r">' + line.gstPercent + '%</td><td class="r">₹' + line.tax.toFixed(2) + '</td>'));
    });
    assert.ok(!html.includes('Accountant Reconciliation Notice:'));
  });
});

test('GST Audit: all eight saved orders match without changing their data', function () {
  var db = JSON.parse(fixture);
  var reconciliation = reports.getGstReconciliation(db);
  assert.equal(reconciliation.totalChecked, 8);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  reconciliation.rows.forEach(function (row) {
    assert.equal(row.matched, true, 'Order #' + row.orderId);
    assert.equal(row.invoiceDiscount, row.ledgerDiscount);
    assert.equal(row.invoiceTax, row.ledgerTax);
    assert.equal(row.invoiceTotal, row.ledgerTotal);
  });
  assert.equal(JSON.stringify(db), JSON.stringify(JSON.parse(fixture)));
});
