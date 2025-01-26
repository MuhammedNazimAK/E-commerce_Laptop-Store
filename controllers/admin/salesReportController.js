const Order = require('../../models/orderModel');
const moment = require('moment');

const { generatePDF } = require('../.././public/javascript/pdfGenerator');
const StatusCodes = require('../../public/javascript/statusCodes');


const getSalesReport = async (req, res) => {
  try {
    res.render('admin/sales-report');
  } catch (error) {
    console.error('Error rendering sales report page:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Error rendering sales report page' });
  }
};


const generateSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, reportType } = req.body;
    const format = req.query.format || 'json';
    const query = buildDateQuery(startDate, endDate, reportType);
    const orders = await Order.find(query).populate({
      path: 'products.product',
      populate: { path: 'category' }
    }).populate('userId', 'firstName lastName');
    const report = generateReportData(orders);

    if (format === 'pdf') {
      const dateRange = getDateRangeString(startDate, endDate, reportType);
      const pdfBuffer = await generatePDF(report, dateRange);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="sales-report-${moment().format('YYYY-MM-DD')}.pdf"`);
      return res.send(pdfBuffer);
    } else {
      res.json(report);
    }
  } catch (error) {
    console.error('Error generating sales report:', error);
    if (typeof report !== 'undefined') {
      console.error('Report data:', JSON.stringify(report, null, 2));
    } else {
      console.error('Report data is undefined');
    }
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Error generating sales report', error: error.message });
  }
};


function getDateRangeString(startDate, endDate, reportType) {
  if (startDate && endDate) {
    return `${moment(startDate).format('MMM D, YYYY')} - ${moment(endDate).format('MMM D, YYYY')}`;
  }
  switch (reportType) {
    case 'daily':
      return moment().format('MMMM D, YYYY');
    case 'weekly':
      return `${moment().startOf('week').format('MMM D')} - ${moment().endOf('week').format('MMM D, YYYY')}`;
    case 'monthly':
      return moment().format('MMMM YYYY');
    case 'yearly':
      return moment().format('YYYY');
    default:
      return 'Custom Range';
  }
}


function buildDateQuery(startDate, endDate, reportType) {
  if (startDate && endDate) {
    return {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
  }

  const reportTypeToMomentMap = {
    daily: 'day',
    weekly: 'week',
    monthly: 'month',
    yearly: 'year'
  };

  const momentPeriod = reportTypeToMomentMap[reportType];
  return momentPeriod ? { createdAt: { $gte: moment().startOf(momentPeriod).toDate() } } : {};
}


function generateReportData(orders) {
  const report = {
    totalSales: 0,
    totalDiscount: 0,
    totalCouponsUsed: 0,
    ordersCount: orders.length,
    salesByProduct: {},
    salesByCategory: {},
    ordersList: []
  };

  orders.forEach(order => {
    report.totalSales += order.total;
    report.totalDiscount += order.discount || 0;
    report.totalCouponsUsed += order.couponUsed ? 1 : 0;
    report.ordersList.push({
      orderId: order.orderId,
      date: order.createdAt,
      total: order.total,
      status: order.status,
      customerName: `${order.userId.firstName} ${order.userId.lastName}`
    });

    order.products.forEach(item => {
      if (item.product) {
        // Update sales by product
        const productId = item.product._id.toString();
        if (!report.salesByProduct[productId]) {
          report.salesByProduct[productId] = {
            name: item.product.basicInformation.name,
            quantity: 0,
            revenue: 0
          };
        }
        report.salesByProduct[productId].quantity += item.quantity;
        report.salesByProduct[productId].revenue += item.price * item.quantity;

        // Update sales by category
        if (item.product.category && item.product.category.length > 0) {
          const category = item.product.category[0];
          const categoryId = category._id ? category._id.toString() : 'unknown';
          const categoryName = category.name || 'Unknown Category';
          if (!report.salesByCategory[categoryId]) {
            report.salesByCategory[categoryId] = {
              name: categoryName,
              quantity: 0,
              revenue: 0
            };
          }
          report.salesByCategory[categoryId].quantity += item.quantity;
          report.salesByCategory[categoryId].revenue += item.price * item.quantity;
        }
      }
    });
  });

  // Convert salesByProduct and salesByCategory to arrays and sort
  report.salesByProduct = Object.values(report.salesByProduct).sort((a, b) => b.revenue - a.revenue);
  report.salesByCategory = Object.values(report.salesByCategory).sort((a, b) => b.revenue - a.revenue);
  report.ordersList.sort((a, b) => b.date - a.date);

  return report;
}



module.exports = {
  getSalesReport,
  generateSalesReport
};