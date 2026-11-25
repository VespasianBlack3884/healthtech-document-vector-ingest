import { appointmentNotification } from "./healthtech_ingest.ts";

const urgent = appointmentNotification("urgent", 3);
if (urgent !== "Care team review requested before publishing 3 document sections.") {
  throw new Error(`Unexpected urgent notification: ${urgent}`);
}

const routine = appointmentNotification("routine", 3);
if (routine !== "3 document sections queued for routine appointment review.") {
  throw new Error(`Unexpected routine notification: ${routine}`);
}

console.log("appointment notification decisions pass");
