import NewAppointmentDemo from "./NewAppointmentDemo.jsx";

function NewAppointmentModalDemo({ appointments = [], onClose, onCreateAppointment, onDateChange, selectedDate }) {
  return (
    <section className="sale-history-modal" role="dialog" aria-modal="true" aria-label="Nueva cita demo">
      <article className="sale-history-dialog new-appointment-demo-dialog">
        <div className="section-title compact-section-title">
          <div>
            <h2>Nueva cita demo</h2>
            <span>Modo demo local — la cita no se guarda en Firebase y desaparecerá al recargar</span>
          </div>
          <button className="secondary-button" type="button" onClick={onClose}>Cerrar</button>
        </div>
        <NewAppointmentDemo
          appointments={appointments}
          onCancel={onClose}
          onCreateAppointment={onCreateAppointment}
          selectedDate={selectedDate}
          onDateChange={onDateChange}
        />
      </article>
    </section>
  );
}

export default NewAppointmentModalDemo;
