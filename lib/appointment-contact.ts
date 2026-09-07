export type AppointmentContactSource = {
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  client?: {
    fullName: string;
    email: string;
    phone: string;
  } | null;
};

export function appointmentContact(appointment: AppointmentContactSource) {
  return {
    fullName: appointment.contactName ?? appointment.client?.fullName ?? "",
    email: appointment.contactEmail ?? appointment.client?.email ?? "",
    phone: appointment.contactPhone ?? appointment.client?.phone ?? "",
  };
}
