Screens.customers = makeParties({
  key:'customers', title:'👥 العملاء', addLabel:'عميل جديد',
  balLabel:'عليه لنا', sumLabel:'إجمالي الديون على العملاء',
  payLabel:'استلام دفعة من العميل', payDone:'استلام', cashSign:1,
  link:'customerId', docLabel:'🛒 بيع آجل', docs:() => DB.list('sales'),
  add: c => DB.addCustomer(c)
});