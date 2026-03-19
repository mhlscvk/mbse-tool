package IfThenElse {

  action def CheckCondition;
  action def ProcessNormal;
  action def ProcessEmergency;
  action def LogResult;

  attribute def Status {
    attribute isNormal : Boolean;
  }

  action handleEvent {
    action check : CheckCondition;
    action processNormal : ProcessNormal;
    action processEmergency : ProcessEmergency;
    action log : LogResult;

    first start then check;
    first check then decide decision1;

    decide decision1;
    if isNormal then processNormal;
    if isEmergency then processEmergency;

    first processNormal then merge1;
    first processEmergency then merge1;
    merge merge1;
    first merge1 then log;
    first log then done;
  }
}
