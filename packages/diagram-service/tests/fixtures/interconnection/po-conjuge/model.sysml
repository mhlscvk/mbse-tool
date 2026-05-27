package conjuge {

    part part1 {
        port port1;
        port port2;
        port port3 {
            out ref1;
        }
        port portDef1 : portDef1;
    }
    part part2 {
        port port1;
        port port2;
        port port3 {
            in ref1;
        }
        port portDef1 : ~portDef1;
    }
    connection connect part1.port1 to part2.port1;
    interface connect part1.port2 to part2.port2;
    flow from part1.port3.ref1 to part2.port3.ref1;
    binding bind part1.portDef1 = part2.portDef1;
    port def portDef1;
}
