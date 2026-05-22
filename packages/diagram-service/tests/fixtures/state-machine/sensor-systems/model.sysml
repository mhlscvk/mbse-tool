package SensorSystems {
    state def SensorSystemStates {
        state Off;

        state On {
            entry action activation {
                action powerControl;
                action powerProtect;
                action activateSubsystems;
                first powerControl then powerProtect;
                first powerProtect then activateSubsystems;
            }
            do action controlHealth {
                action controlComunicationwithSubsystems;
            }
            exit action checkPowerStatus {
                action turnOffEachSubsystemInSafeOrder;
            }

            state Normal {
                entry action checkPowerSource;
                do action operationActions;
                exit action TBD;
            }

            state Degraded {
                entry action decreasePowerConsumption;
                do action restrictedOperations;
                exit action ;
            }

            transition first States::StateAction::start accept ItemDefs::HealthOK then Normal;
            transition first Normal accept ItemDefs::BatteryPower via sensor2Platform then Degraded;
            transition first Degraded accept ItemDefs::MainPower via sensor2Platform then Normal;
        }

        state Error;

        transition first Off accept ItemDefs::PowerOn via sensor2Platform then On;
        transition first On accept ItemDefs::PowerOff via sensor2Platform then Off;
        transition first On accept ItemDefs::HealthNotOK then Error;
        transition first Error then States::StateAction::done;
        transition first States::StateAction::start then Off;
        transition first Error then Off;
        transition first Error accept ItemDefs::PowerOff then Off;
        transition first On then States::StateAction::done;
    }
}
