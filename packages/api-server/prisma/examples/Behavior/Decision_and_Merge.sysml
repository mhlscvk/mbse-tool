package DecisionAndMerge {
  private import ScalarValues::*;

  action def ProcessOrder;
  action def ShipStandard;
  action def ShipExpress;
  action def NotifyCustomer;

  action fulfillOrder {
    action processOrder : ProcessOrder;
    action shipStandard : ShipStandard;
    action shipExpress : ShipExpress;
    action notifyCustomer : NotifyCustomer;

    first start then processOrder;
    first processOrder then decision1;
    decide decision1;
    first decision1 then shipStandard;
    first decision1 then shipExpress;
    first shipStandard then merge1;
    first shipExpress then merge1;
    merge merge1;
    first merge1 then notifyCustomer;
    first notifyCustomer then done;
  }
}