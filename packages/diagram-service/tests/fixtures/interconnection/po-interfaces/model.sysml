package Interfaces {
    interface def TypeA_to_TypeC {
        part converter {
            port a1;
            port a12;
            port b1;
            port b12;
            port pin1;
            port pin3;
            port pin2;
            port pin4;
            port a4;
            port b4;
            port a9;
            port b9;
            interface connect a1 to pin4;
            interface connect a12 to pin4;
            interface connect b1 to pin4;
            interface connect b12 to pin4;
            interface connect a4 to pin1;
            interface connect b4 to pin1;
            port a6;
            port a7;
            interface connect a6 to pin3;
            interface connect a7 to pin2;
        }
        end usbA : USB_A;
        end usbC : USB_C;
        interface connect converter.pin4 to usbA.pin4;
        interface connect converter.pin1 to usbA.pin1;
        interface connect converter.pin3 to usbA.pin3;
        interface connect converter.pin2 to usbA.pin2;

        interface connect usbC.a1 to converter.a1;
        interface connect usbC.a12 to converter.a12;
        interface connect usbC.b1 to converter.b1;
        interface connect usbC.b12 to converter.b12;
        interface connect usbC.a4 to converter.a4;
        interface connect usbC.b4 to converter.b4;
        interface connect usbC.a9 to converter.a9;
        interface connect usbC.b9 to converter.b9;
        interface connect usbC.a6 to converter.a6;
        interface connect usbC.a7 to converter.a7;
    }
    part system {
        part power_adapter {
            port usbA : USB_A;
        }
        part device {
            port usbC : USB_C;
        }
        interface : TypeA_to_TypeC connect power_adapter.usbA to device.usbC;
    }
    port def USB_A {
        port pin4;
        port pin1;
        port pin2;
        port pin3;
    }
    port def USB_C {
        port a1;
        port a12;
        port b1;
        port b12;
        port a4;
        port b4;
        port a9;
        port b9;
        port a6;
        port a7;
    }
}
