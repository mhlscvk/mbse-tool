package 'Comment Example' {
  comment /* This is a comment, part of the model, annotating (by default) its owning package. */
  comment Comment1 /* This is a named comment. */
  comment about Automobile /* This is an unnamed comment, annotating an explicitly specified element. */
  part def Automobile;
  alias Car for Automobile {
    comment /* This is a comment annotating its owning element. */
  }
  alias Torque for ISQ::TorqueValue;
}