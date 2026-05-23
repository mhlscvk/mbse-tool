// Anonymized multi-root state-machine fixture (Slice 2d.1).
//
// Mirrors the idiomatic SysML v2 / MagicGrid pattern that crashed the Slice 2d
// transformer: state machines modelled as `state` USAGES nested inside a part
// hierarchy (no standalone `state def`), with two independent machines in one
// part. Names are domain-free and there is no business logic. See README.md.
package SystemAlpha {
    part def UnitContext {
        part unit {
            // Machine 1 — composite: nested states + entry/do/exit compartments.
            state ModeAlpha {
                state Idle;
                state Active {
                    entry action begin;
                    do action run;
                    exit action stop;

                    state Running;
                    state Paused;

                    transition first Running then Paused;
                    transition first Paused then Running;
                }
                transition first Idle then Active;
                transition first Active then Idle;
            }

            // Machine 2 — independent, flat: a separate top-level root.
            state ModeBeta {
                state Open;
                state Closed;
                transition first Open then Closed;
                transition first Closed then Open;
            }
        }
    }
}
