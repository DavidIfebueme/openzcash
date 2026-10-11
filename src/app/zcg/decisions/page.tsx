import { permanentRedirect } from "next/navigation";

/** Preserve direct and client-side links into the former decisions page. */
export default function DecisionsRedirect() {
  permanentRedirect("/zcg/participate?view=history");
}
