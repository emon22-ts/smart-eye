from __future__ import annotations
import os
from datetime import datetime
from typing import Any, Dict

try:
    from fpdf import FPDF
    _HAVE_FPDF = True
except ImportError:
    _HAVE_FPDF = False

def generate_pdf(summary, session_id, output_path, gradcam_b64=None):
    if not _HAVE_FPDF:
        raise RuntimeError("fpdf2 not installed")
    disease = summary.get("disease", {})
    fatigue = summary.get("fatigue", {})
    ohi = summary.get("ohi", {})
    rec = summary.get("recommendation", {})
    symptoms = summary.get("symptoms_aggregate", 0.0)
    is_mock = disease.get("is_mock", True)
    ohi_score = ohi.get("ohi", 0.0)
    band = ohi.get("band", "Unknown")
    colour = ohi.get("colour", "green")
    colour_map = {"green": (34,139,34), "amber": (210,140,0), "red": (180,0,0)}
    r, g, b = colour_map.get(colour, (80,80,80))
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 10, "Smart Eye - Ocular Health Report", ln=True, align="C")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(100,100,100)
    pdf.cell(0, 6, f"Session ID: {session_id}   |   Generated: {datetime.now().strftime('%d %b %Y, %H:%M')}", ln=True, align="C")
    pdf.ln(4)
    pdf.set_draw_color(200,0,0)
    pdf.set_line_width(0.8)
    pdf.set_fill_color(255,245,245)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(180,0,0)
    pdf.multi_cell(0, 6, "WARNING: Smart Eye does NOT provide a clinical diagnosis. Consult a qualified healthcare professional.", border=1, fill=True)
    pdf.ln(4)
    if is_mock:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(150,100,0)
        pdf.set_fill_color(255,250,220)
        pdf.multi_cell(0, 6, "MOCK MODEL ACTIVE - Predictions are placeholders with no clinical meaning.", border=1, fill=True)
        pdf.ln(4)
    pdf.set_text_color(0,0,0)
    pdf.set_draw_color(0,0,0)
    pdf.set_line_width(0.2)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_fill_color(240,240,240)
    pdf.cell(0, 7, "  1. Ocular Health Index (OHI)", ln=True, fill=True)
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 36)
    pdf.set_text_color(r,g,b)
    pdf.cell(0, 14, f"{ohi_score:.0f} / 100", ln=True, align="C")
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, f"Risk Band: {band.upper()}", ln=True, align="C")
    pdf.set_text_color(0,0,0)
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_fill_color(240,240,240)
    pdf.cell(0, 7, "  2. Disease Screening", ln=True, fill=True)
    pdf.ln(2)
    probs = disease.get("probabilities", {})
    top_class = disease.get("top_class", "N/A")
    top_conf = disease.get("top_confidence", 0.0)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"Top prediction: {top_class}  ({top_conf*100:.1f}%)", ln=True)
    pdf.ln(2)
    for cls, prob in probs.items():
        pct = prob * 100
        bar_w = max(pct * 1.5, 0.1)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(55, 5, cls, ln=False)
        pdf.set_fill_color(r,g,b)
        pdf.cell(bar_w, 5, "", fill=True, ln=False)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(20, 5, f" {pct:.1f}%", ln=True)
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_fill_color(240,240,240)
    pdf.cell(0, 7, "  3. Fatigue Monitoring", ln=True, fill=True)
    pdf.ln(2)
    for key, val in [("Blink Rate", f"{fatigue.get('blink_rate_bpm',0):.1f} bpm (healthy: 15-20)"),
                     ("EAR", f"{fatigue.get('ear',0):.3f} (threshold: 0.25)"),
                     ("Fatigue Score", f"{fatigue.get('fatigue_score',0):.0f}/100"),
                     ("Drowsy", "YES" if fatigue.get("drowsy") else "No")]:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(65, 6, f"  {key}:", ln=False)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, val, ln=True)
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_fill_color(240,240,240)
    pdf.cell(0, 7, "  4. Symptom Score", ln=True, fill=True)
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(65, 6, "  Aggregate severity:", ln=False)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"{symptoms:.2f} / 5.0", ln=True)
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_fill_color(240,240,240)
    pdf.cell(0, 7, "  5. Recommended Actions", ln=True, fill=True)
    pdf.ln(2)
    actions = rec.get("actions", [])
    urgency = rec.get("urgency", "routine")
    referral = rec.get("referral_flag", False)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, f"Urgency: {urgency.upper()}{'  |  Referral recommended' if referral else ''}", ln=True)
    pdf.ln(1)
    pdf.set_font("Helvetica", "", 10)
    for i, action in enumerate(actions, 1):
        pdf.multi_cell(0, 6, f"{i}. {action}", ln=True)
    if gradcam_b64:
        try:
            import base64, tempfile
            _b64 = gradcam_b64.split(",", 1)[-1]
            _tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
            _tmp.write(base64.b64decode(_b64))
            _tmp.close()
            pdf.ln(3)
            pdf.set_font("Helvetica", "B", 11)
            pdf.set_fill_color(240, 240, 240)
            pdf.cell(0, 7, "  6. Grad-CAM Explainability", ln=True, fill=True)
            pdf.ln(2)
            pdf.image(_tmp.name, w=70)
            pdf.set_font("Helvetica", "I", 8)
            pdf.set_text_color(120, 120, 120)
            pdf.multi_cell(0, 5, "Warm regions show where the model attended (ResNet branch). Explainability aid, not a diagnostic marker.")
            pdf.set_text_color(0, 0, 0)
        except Exception:
            pass
    pdf.set_y(-15)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(130,130,130)
    pdf.cell(0, 10, "Generated by Smart Eye  |  For screening support only  |  Not a clinical diagnosis", align="C")
    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)
    pdf.output(output_path)
    return output_path

if __name__ == "__main__":
    sample = {
        "disease": {"probabilities": {"Normal":0.15,"Cataract":0.62,"Glaucoma":0.18,"Diabetic_Retinopathy":0.05},
                    "top_class":"Cataract","top_confidence":0.62,"is_mock":True,"model_id":"mock-v0"},
        "fatigue": {"ear":0.28,"blink_rate_bpm":8.0,"drowsy":False,"fatigue_score":42.0,"face_detected":True},
        "ohi": {"ohi":62.0,"risk_index":38.0,"band":"Moderate","colour":"amber","rule_activations":[]},
        "recommendation": {"actions":["Schedule an eye exam within 2 weeks.","Reduce screen time."],
                           "urgency":"soon","referral_flag":True,"disclaimer":"Not a clinical diagnosis."},
        "symptoms_aggregate": 2.75, "latency_ms": 312.0,
    }
    out = generate_pdf(sample, session_id=42, output_path="/tmp/test_report.pdf")
    print(f"PDF saved to: {out}")
