package MultiPortIv {
  port def PowerPort {
    out item current;
  }
  port def SignalPort {
    in item level;
  }

  part def Converter {
    port pwrIn : PowerPort;
    port pwrOut : PowerPort;
    port ctrl : SignalPort;
  }

  part assembly {
    part source {
      port out : PowerPort;
    }
    part conv : Converter;
    part sink {
      port in : PowerPort;
    }
    connect source.out to conv.pwrIn;
    connect conv.pwrOut to sink.in;
    flow from source.out to conv.pwrIn;
  }
}
