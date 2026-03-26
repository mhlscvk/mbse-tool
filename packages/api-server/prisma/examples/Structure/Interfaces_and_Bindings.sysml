package InterfacesAndBindings {
    item def ElectricalPower;
    item def DataSignal;

    port def PowerOutPort {
        out item power : ElectricalPower;
    }

    port def PowerInPort {
        in item power : ElectricalPower;
    }

    port def DataPort {
        inout item data : DataSignal;
    }

    /* Interface definition — specifies a connection contract */
    interface def PowerInterface {
        end source : PowerOutPort;
        end target : PowerInPort;
    }

    interface def DataBus {
        end endA : DataPort;
        end endB : DataPort;
    }

    part def Battery {
        port powerOut : PowerOutPort;
    }

    part def Motor {
        port powerIn : PowerInPort;
        port commPort : DataPort;
    }

    part def Controller {
        /* Conjugated port — reverses the flow direction */
        port powerSupply : ~PowerOutPort;
        port commPort : DataPort;
        attribute maxCurrent : Real;
    }

    part def ElectricDrivetrain {
        part battery : Battery;
        part motor : Motor;
        part controller : Controller;

        /* Interface usage — typed connection between ports */
        interface powerLink : PowerInterface
            connect battery.powerOut to motor.powerIn;

        interface dataLink : DataBus
            connect controller.commPort to motor.commPort;

        /* Bind — equates two features so they share the same value */
        bind battery.powerOut.power = motor.powerIn.power;
        bind controller.commPort.data = motor.commPort.data;
    }
}
