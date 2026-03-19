package MetadataExample {
  private import ScalarValues::*;

  metadata def Approval {
    attribute approved : Boolean;
    attribute approver : String;
  }

  metadata def Safety {
    attribute level : String;
  }

  part def BrakeSystem {
    doc /* The vehicle braking system. */
    attribute brakingForce : Real;
    attribute responseTime : Real;
  }

  part def AirbagSystem {
    doc /* The vehicle airbag system. */
    attribute deployTime : Real;
  }

  part safetySystem {
    part brakes : BrakeSystem;
    part airbags : AirbagSystem;
  }
}