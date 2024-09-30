const { generatePDFUser } = require('../../public/javascript/pdfGenerator');


const getInvoice = async (req, res) => {
  try {
    const invoice = await generatePDFUser(req, res);

    if (!invoice) {
      return res.status(404).send('Order not found');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${req.params.orderId}.pdf`);
    res.send(invoice);

  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Error generating invoice');
  }
};


module.exports = {
  getInvoice
};