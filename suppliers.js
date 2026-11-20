Screens.suppliers = makeParties({
  key:'suppliers', title:'🚚 الموردين', addLabel:'مورد جديد',
  balLabel:'له علينا', sumLabel:'إجمالي المستحق للموردين',
  payLabel:'سداد دفعة للمورد', payDone:'سداد', cashSign:-1,
  link:'supplierId', docLabel:'🧾 شراء', docs:() => DB.list('purchases'),
  add: s => DB.addSupplier(s)
});
