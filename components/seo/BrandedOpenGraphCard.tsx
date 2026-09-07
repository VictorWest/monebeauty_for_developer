export function BrandedOpenGraphCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "68px 76px",
        background: "#FBF8F3",
        color: "#3A322B",
        border: "18px solid #E7D9C4",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 28,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#97785A",
        }}
      >
        Mone Beauty Clinic · Helsinki
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          style={{
            display: "flex",
            maxWidth: 930,
            fontFamily: "serif",
            fontSize: 76,
            lineHeight: 1.05,
          }}
        >
          Next-Generation Aesthetic Medicine
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 27,
            color: "#6B6056",
          }}
        >
          Beauty, skin health, face, body and hair — with a personalized
          approach.
        </div>
      </div>
    </div>
  );
}
