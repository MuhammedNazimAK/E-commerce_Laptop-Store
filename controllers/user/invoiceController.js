const { generatePDFUser } = require('../../public/javascript/pdfGenerator');
const StatusCodes = require('../../public/javascript/statusCodes');


const getInvoice = async (req, res) => {
  try {
    const invoice = await generatePDFUser(req, res);

    if (!invoice) {
      return res.status(StatusCodes.NOT_FOUND).send('Invoice not found');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${req.params.orderId}.pdf`);
    res.send(invoice);

  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send('Error generating invoice');
  }
};


module.exports = {
  getInvoice
};