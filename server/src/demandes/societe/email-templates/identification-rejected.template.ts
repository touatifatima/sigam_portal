export type IdentificationRejectedTemplateInput = {
  logoUrl: string;
  displayName: string;
  retryUrl: string;
  supportEmail: string;
  reason?: string | null;
};

const safe = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function buildIdentificationRejectedEmailTemplate(
  input: IdentificationRejectedTemplateInput,
) {
  const name = safe(input.displayName || 'Cher utilisateur');
  const retryUrl = safe(input.retryUrl);
  const supportEmail = safe(input.supportEmail || 'support@anam.dz');
  const logoUrl = safe(input.logoUrl);
  const reason = safe(String(input.reason || '').trim());
  const reasonText = reason ? `Motif: ${reason}` : '';

  return {
    subject: "Mise a jour - Identification d'entreprise refusee",
    text: `Bonjour ${name},\n\nVotre demande d'identification d'entreprise a ete refusee.${reasonText ? `\n${reasonText}` : ''}\nVeuillez verifier vos informations et soumettre une nouvelle demande: ${retryUrl}\nSupport: ${supportEmail}\n\nCordialement,\nANAM`,
    html: `
      <div style="font-family: Arial, sans-serif; background:#f6f8fb; padding:24px;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e6eaf0; border-radius:12px; overflow:hidden;">
          <div style="background:#b42318; color:#fff; padding:18px 22px; display:flex; align-items:center; gap:14px;">
            <img src="${logoUrl}" alt="ANAM" style="height:42px; width:auto; border-radius:6px; background:#fff; padding:4px;" />
            <div>
              <div style="font-size:13px; opacity:.9;">Agence Nationale des Activites Minieres</div>
              <div style="font-size:18px; font-weight:700;">Identification entreprise refusee</div>
            </div>
          </div>
          <div style="padding:22px; color:#111827;">
            <p style="margin:0 0 12px;">Bonjour <strong>${name}</strong>,</p>
            <p style="margin:0 0 14px; line-height:1.6;">
              Votre demande d'identification d'entreprise a ete <strong>refusee</strong>.
            </p>
            ${
              reason
                ? `<p style="margin:0 0 14px; line-height:1.6;"><strong>Motif:</strong> ${reason}</p>`
                : ''
            }
            <p style="margin:0 0 14px; line-height:1.6;">
              Merci de verifier vos informations et de soumettre une nouvelle demande.
            </p>
            <p style="margin:0 0 18px;">
              <a href="${retryUrl}" style="display:inline-block; background:#b42318; color:#fff; text-decoration:none; font-weight:700; padding:10px 16px; border-radius:8px;">
                Reprendre l'identification
              </a>
            </p>
            <p style="margin:0; color:#6b7280; font-size:13px;">
              Besoin d'aide ? Contactez-nous: <a href="mailto:${supportEmail}" style="color:#b42318;">${supportEmail}</a>
            </p>
          </div>
        </div>
      </div>
    `,
  };
}

