const PDFDocument = require('pdfkit');
const Order = require('../../models/orderModel');
const Address = require('../../models/addressModel');
const moment = require('moment');


//ADMIN SIDE 
async function generatePDF(report, dateRange) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    // Colors
    const primaryColor = '#000000';
    const secondaryColor = '#f5a623';
    const textColor = '#333333';
    const borderColor = '#cccccc';

    // Header
    doc.fontSize(24).fillColor(primaryColor).font('Helvetica-Bold').text('Sales Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor(textColor).font('Helvetica').text(`Generated on: ${moment().format('MMMM D, YYYY, h:mm A')}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.text(`Date Range: ${dateRange}`, { align: 'center' });
    doc.moveDown(2);

    // Summary
    addSection(doc, 'Summary', primaryColor, textColor);
    addTable(doc, [
      ['Total Sales', `${report.totalSales.toFixed(2)}`],
      ['Total Discount', `${report.totalDiscount.toFixed(2)}`],
      ['Total Coupons Used', report.totalCouponsUsed.toString()],
      ['Total Orders', report.ordersCount.toString()],
      ['Average Order Value', `${(report.totalSales / report.ordersCount).toFixed(2)}`]
    ], borderColor);

    doc.addPage();
    addSection(doc, 'Orders List', primaryColor, textColor);
    addTable(doc, [
      ['Order ID', 'Date', 'Customer', 'Total', 'Status'],
      ...report.ordersList.map(order => [
        order.orderId,
        moment(order.date).format('YYYY-MM-DD HH:mm'),
        order.customerName,
        `${order.total.toFixed(2)}`,
        order.status
      ])
    ], borderColor);

    // Top Products
    doc.addPage();
    addSection(doc, 'Top 5 Products', primaryColor, textColor);
    const topProducts = report.salesByProduct
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    addTable(doc, [
      ['Product', 'Revenue', 'Quantity'],
      ...topProducts.map(product => [product.name, `${product.revenue.toFixed(2)}`, product.quantity.toString()])
    ], borderColor);

    // Sales by Category
    doc.addPage();
    addSection(doc, 'Sales by Category', primaryColor, textColor);
    addTable(doc, [
      ['Category', 'Revenue'],
      ...report.salesByCategory.map(category => [category.name, `${category.revenue.toFixed(2)}`])
    ], borderColor);

    doc.end();
  });
}

function addSection(doc, title, color, textColor) {
  doc.fontSize(18).fillColor(color).font('Helvetica-Bold').text(title);
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor(textColor).font('Helvetica');
}

function addTable(doc, data, borderColor) {
  const cellPadding = 8;
  const cellWidth = (doc.page.width - 100) / data[0].length;
  const cellHeight = 30;
  const textOptions = { width: cellWidth - cellPadding * 2, align: 'left' };

  const textColor = '#333333';

  data.forEach((row, rowIndex) => {
    const y = doc.y;
    row.forEach((cell, columnIndex) => {
      const x = 50 + columnIndex * cellWidth;
      doc.rect(x, y, cellWidth, cellHeight).strokeColor(borderColor).stroke();
      doc.fillColor(textColor).text(cell, x + cellPadding, y + cellPadding, textOptions);
    });
    doc.moveDown(0.5);
  });
  doc.moveDown();
}



async function generatePDFUser(req, res) {
  try {
    const order = await Order.findOne({ $or: [{ orderId: req.params.orderId }, { _id: req.params.orderId }] })
      .populate('userId')
      .populate('products.product')
      .lean();

      if (order.shippingAddress) {
        const address = await Address.findOne(
          { 'address._id': order.shippingAddress },
          { 'address.$': 1 }
        ).lean();
  
        if (address && address.address && address.address.length > 0) {
          order.shippingAddress = address.address[0];
        } else {
          order.shippingAddress = null;
        }
      }

    if (!order) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 40, right: 40 }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Colors
      const primaryColor = '#000000';
      const textColor = '#333333';

      // Draw border
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();

      // Header
      doc.font('Helvetica-Bold')
         .fontSize(24)
         .fillColor(primaryColor)
         .text('Laptop Store', 40, 40);

      doc.font('Helvetica-Bold')
         .fontSize(16)
         .fillColor('#FFFFFF')
         .rect(doc.page.width - 140, 40, 100, 30)
         .fill(primaryColor)
         .fillColor('#FFFFFF')
         .text('INVOICE', doc.page.width - 130, 48);

      // Invoice Details
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(textColor)
         .text(`Invoice Number: INV-${order.orderId}`, 40, 80)
         .text(`Order Number: ${order.orderId}`, 40, 95)
         .text(`Invoice Date: ${moment(order.createdAt).format('MMMM D, YYYY')}`, 40, 110)
         .text(`Due Date: ${moment(order.createdAt).add(30, 'days').format('MMMM D, YYYY')}`, 40, 125);

      // Billing Information
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .text('Bill from:', 40, 150)
         .font('Helvetica')
         .fontSize(10)
         .text('Laptop Store', 40, 165)
         .text('123 Business Street', 40, 180)
         .text('Thrissur, Kerala, 680507', 40, 195)
         .text('Phone: (123) 456-7890', 40, 210)
         .text('Email: support@laptopstore.com', 40, 225);

      doc.font('Helvetica-Bold')
         .fontSize(12)
         .text('Bill to:', 300, 150)
         .font('Helvetica')
         .fontSize(10)
         .text(`${order.userId.firstName} ${order.userId.lastName}`, 300, 165)

      if (order.shippingAddress) {
          doc.text(`${order.shippingAddress.name}, ${order.shippingAddress.addressType}`, 300, 180)
             .text(`${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pinCode}`, 300, 195)
             .text(`Mobile: ${order.shippingAddress.mobile}`, 300, 210);
        } else {
          doc.text('Address not available', 300, 180);
        }

      // Table
      const tableTop = 250;
      const tableHeaders = ['Item', 'Qty', 'Unit Price', 'GST', 'Discount', 'Total', 'Status'];
      const tableData = order.products.map(item => [
        item.product.basicInformation.name,
        item.quantity.toString(),
        `${item.price.toFixed(2)}`,
        `${(item.price * 0.18).toFixed(2)}`,
        `${(item.discountAmount || 0).toFixed(2)}`,
        `${(item.quantity * item.price).toFixed(2)}`,
        item.status || 'PAID'
      ]);

      createTable(doc, tableTop, tableHeaders, tableData);

      // Totals
      const totalsTop = doc.y + 20;
      const totalsLeft = 40;
      doc.font('Helvetica').fontSize(10);

      doc.text('Subtotal:', totalsLeft, totalsTop)
         .text('GST (18%):', totalsLeft, totalsTop + 15)
         .text('Shipping:', totalsLeft, totalsTop + 30)
         .text('Discount:', totalsLeft, totalsTop + 45);

      doc.font('Helvetica-Bold').fontSize(12)
         .fillColor('#FFFFFF')
         .rect(totalsLeft, totalsTop + 60, 525, 25)
         .fill(primaryColor)
         .fillColor('#FFFFFF')
         .text('Total:', totalsLeft + 10, totalsTop + 65);

      doc.font('Helvetica').fontSize(10)
         .fillColor(textColor)
         .text(`${order.subtotal.toFixed(2)}`, totalsLeft + 120, totalsTop, { align: 'right' })
         .text(`${order.gst.toFixed(2)}`, totalsLeft + 120, totalsTop + 15, { align: 'right' })
         .text(`${order.shippingCharge.toFixed(2)}`, totalsLeft + 120, totalsTop + 30, { align: 'right' })
         .text(`${order.discountAmount.toFixed(2)}`, totalsLeft + 120, totalsTop + 45, { align: 'right' });

      doc.font('Helvetica-Bold').fontSize(12)
         .fillColor('#FFFFFF')
         .text(`${order.total.toFixed(2)}`, totalsLeft + 120, totalsTop + 65, { align: 'right' });

      // Payment Method
      doc.moveDown()
         .font('Helvetica')
         .fontSize(10)
         .fillColor(textColor)
         .text(`Payment Method: ${order.paymentMethod}`, 40, doc.y);

      // Terms and Conditions
      doc.moveDown()
         .font('Helvetica-Bold')
         .fontSize(10)
         .text('Terms & Conditions:', 40, doc.y);

      doc.font('Helvetica').fontSize(8)
         .text('1. All products are for personal use only and not for resale.', 40, doc.y + 5)
         .text('2. Prices are subject to change without notice. Please confirm pricing before placing your order.', 40, doc.y + 5)
         .text('3. You may return items within 7 days of delivery for a full refund if they are in original condition.', 40, doc.y + 5)
         .text('4. Warranty claims must be submitted within the product warranty period.', 40, doc.y + 5)
         .text('5. Laptop Store is not responsible for any indirect damages arising from the use of our products.', 40, doc.y + 5)
         .text('6. For any assistance, please contact our support at support@laptopstore.com.', 40, doc.y + 5);

      // Thank You Note
      doc.moveDown()
         .font('Helvetica-Bold')
         .fontSize(10)
         .text('Thank you for shopping with Laptop Store!', 40, doc.y)
         .font('Helvetica')
         .fontSize(8)
         .text('We appreciate your business and hope to serve you again!', 40, doc.y + 5);

      doc.end();
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    throw error;
  }
}

function createTable(doc, y, headers, data) {
  const columnCount = headers.length;
  const columnWidths = [130, 40, 70, 60, 60, 70, 60]; // Adjusted column widths
  const rowHeight = 20;
  let currentY = y;

  // Draw headers
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
  headers.forEach((header, i) => {
    doc.rect(40 + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), currentY, columnWidths[i], rowHeight).stroke();
    doc.text(header, 45 + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), currentY + 5, {
      width: columnWidths[i] - 10,
      align: 'left'
    });
  });

  currentY += rowHeight;
  doc.font('Helvetica').fontSize(9).fillColor('#333333');

  // Draw rows
  for (const row of data) {
    row.forEach((cell, i) => {
      doc.rect(40 + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), currentY, columnWidths[i], rowHeight).stroke();
      doc.text(cell, 45 + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), currentY + 5, {
        width: columnWidths[i] - 10,
        align: 'left'
      });
    });

    currentY += rowHeight;
  }

  doc.moveDown();
} 



module.exports = { generatePDF, generatePDFUser };