package RequirementsAdvanced {
    part def Vehicle;
    part def BrakingSystem;

    attribute def Mass;
    attribute def Speed;

    /* Constraint definition and usage */
    constraint def MaxMassConstraint {
        attribute massLimit : Mass;
        attribute actualMass : Mass;
    }

    constraint massCheck : MaxMassConstraint;
    constraint speedCheck {
        attribute maxSpeed : Speed;
    }

    /* Requirement with concern */
    concern def SafetyConcern {
        doc /* Stakeholders are concerned about vehicle safety. */
        stakeholder regulatoryBody;
    }

    requirement def BrakingRequirement {
        doc /* The braking system shall stop the vehicle within required distance. */
        subject brakingSystem : BrakingSystem;

        attribute stoppingDistance : Mass;
        attribute maxSpeed : Speed;

        /* Assert constraint within requirement */
        assert constraint distanceLimit : MaxMassConstraint;
    }

    requirement brakingSpec : BrakingRequirement {
        subject brakes : BrakingSystem;
    }

    concern safetyConcern : SafetyConcern;

    part vehicle : Vehicle {
        part brakes : BrakingSystem;

        /* Satisfy requirement */
        satisfy requirement brakingSpec by brakes;
    }
}
