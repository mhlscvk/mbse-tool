// W5 guard fixture (Slice 6a CP-1.5): exercises specialization (:>) and typed
// usages so that resolveInheritedAttributes WOULD inject inherited attributes
// in a non-filtered view. The differential oracle asserts showInherited true
// vs false stay byte-identical for the interconnection view, because the IV
// filter strips the dependency '«specializes»' / typereference edges that
// inheritance resolution consumes. If a future filter change admits those
// edges to IV, this fixture's guard assertion fails.
package InheritanceIv {
  part def Base {
    attribute baseAttr : Real;
    port p : SignalPort;
  }
  part def Derived :> Base {
    attribute derivedAttr : Real;
  }
  port def SignalPort {
    out item s;
  }

  part rig {
    part unit : Derived;
  }
}
