const Order = require('../../models/orderModel');
const Product = require('../../models/productModel');
const Category = require('../../models/categoryModel');
const StatusCodes = require('../../public/javascript/statusCodes');
const moment = require('moment');

exports.getDashboardData = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalCategories = await Category.countDocuments();

    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'name')
      .lean();

    const salesData = await getSalesData('yearly');
    const topLists = await getTopLists();

    res.json({
      totalOrders,
      totalProducts,
      totalCategories,
      recentOrders,
      salesData,
      topLists
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Error fetching dashboard data' });
  }
};

exports.getSalesData = async (req, res) => {
  try {
    const filter = req.query.filter || 'yearly';
    const salesData = await getSalesData(filter);
    res.json(salesData);
  } catch (error) {
    console.error('Error fetching sales data:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Error fetching sales data' });
  }
};

async function getSalesData(filter) {
  let startDate, endDate, groupBy, dateFormat;

  switch (filter) {
    case 'yearly':
      startDate = moment().subtract(5, 'years').startOf('year');
      groupBy = { $year: '$createdAt' };
      dateFormat = '%Y';
      break;
    case 'monthly':
      startDate = moment().subtract(12, 'months').startOf('month');
      groupBy = { 
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
      dateFormat = '%Y-%m';
      break;
    case 'weekly':
      startDate = moment().subtract(12, 'weeks').startOf('week');
      groupBy = { 
        year: { $year: '$createdAt' },
        week: { $week: '$createdAt' }
      };
      dateFormat = '%Y-W%V';
      break;
    case 'daily':
      startDate = moment().subtract(30, 'days').startOf('day');
      groupBy = { 
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
      dateFormat = '%Y-%m-%d';
      break;
  }

  endDate = moment().endOf('day');

  const salesData = await Order.aggregate([
    { $match: { createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() } } },
    { $group: {
      _id: groupBy,
      totalRevenue: { $sum: '$total' },
      orderCount: { $sum: 1 },
      avgOrderValue: { $avg: '$total' }
    }},
    { $sort: { '_id': 1 } }
  ]);

  let cumulativeRevenue = 0;
  const formattedData = salesData.map(item => {
    let dateString;
    if (filter === 'yearly') {
      dateString = item._id.toString();
    } else if (filter === 'monthly') {
      dateString = `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`;
    } else if (filter === 'weekly') {
      dateString = `${item._id.year}-W${item._id.week.toString().padStart(2, '0')}`;
    } else {
      dateString = `${item._id.year}-${item._id.month.toString().padStart(2, '0')}-${item._id.day.toString().padStart(2, '0')}`;
    }
    cumulativeRevenue += item.totalRevenue;
    return {
      date: dateString,
      totalRevenue: item.totalRevenue,
      orderCount: item.orderCount,
      avgOrderValue: item.avgOrderValue,
      cumulativeRevenue
    };
  });

  return formattedData;
}

async function getTopLists() {
  const startDate = moment().subtract(30, 'days').startOf('day').toDate();
  const endDate = moment().endOf('day').toDate();


  const topProducts = await Order.aggregate([
    { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
    { $unwind: '$products' },
    { $lookup: {
      from: 'products',
      localField: 'products.product',
      foreignField: '_id',
      as: 'productDetails'
    }},
    { $unwind: '$productDetails' },
    { $group: {
      _id: '$products.product',
      name: { $first: '$productDetails.basicInformation.name' },
      revenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } }
    }},
    { $sort: { revenue: -1 } },
    { $limit: 10 }
  ]);


  const topCategories = await Order.aggregate([
    { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
    { $unwind: '$products' },
    { $lookup: {
      from: 'products',
      localField: 'products.product',
      foreignField: '_id',
      as: 'productDetails'
    }},
    { $unwind: '$productDetails' },
    { $unwind: '$productDetails.category' },
    { $lookup: {
      from: 'categories',
      localField: 'productDetails.category',
      foreignField: '_id',
      as: 'categoryDetails'
    }},
    { $unwind: '$categoryDetails' },
    { $group: {
      _id: '$categoryDetails._id',
      name: { $first: '$categoryDetails.name' },
      revenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } }
    }},
    { $sort: { revenue: -1 } },
    { $limit: 10 }
  ]);


  const topBrands = await Order.aggregate([
    { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
    { $unwind: '$products' },
    { $lookup: {
      from: 'products',
      localField: 'products.product',
      foreignField: '_id',
      as: 'productDetails'
    }},
    { $unwind: '$productDetails' },
    { $group: {
      _id: '$productDetails.basicInformation.brand',
      name: { $first: '$productDetails.basicInformation.brand' },
      revenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } }
    }},
    { $sort: { revenue: -1 } },
    { $limit: 10 }
  ]);

  return {
    products: topProducts,
    categories: topCategories,
    brands: topBrands
  };
}
