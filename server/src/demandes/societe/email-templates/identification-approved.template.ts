export type IdentificationApprovedTemplateInput = {
  logoUrl: string;
  displayName: string;
  loginUrl: string;
};

const safe = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function buildIdentificationApprovedEmailTemplate(
  input: IdentificationApprovedTemplateInput,
) {
  const name = safe(input.displayName || 'Cher utilisateur');
  const loginUrl = safe(input.loginUrl);
  const logoUrl = safe(input.logoUrl);

  return {
    subject: 'Bienvenue sur SIGAM - Entreprise confirmee',
    text: `Bonjour ${name},\n\nVotre entreprise a ete confirmee par l'administration ANAM.\nVous pouvez maintenant acceder a votre compte: ${loginUrl}\n\nCordialement,\nANAM`,
    html: `
      <div style="font-family: Arial, sans-serif; background:#f6f8fb; padding:24px;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e6eaf0; border-radius:12px; overflow:hidden;">
          <div style="background:#0f766e; color:#fff; padding:18px 22px; display:flex; align-items:center; gap:14px;">
            <img src="${logoUrl}" alt="ANAM" style="height:42px; width:auto; border-radius:6px; background:#fff; padding:4px;" />
            <div>
              <div style="font-size:13px; opacity:.9;">Agence Nationale des Activites Minieres</div>
              <div style="font-size:18px; font-weight:700;">Verification entreprise validee</div>
            </div>
          </div>
          <div style="padding:22px; color:#111827;">
            <p style="margin:0 0 12px;">Bonjour <strong>${name}</strong>,</p>
            <p style="margin:0 0 14px; line-height:1.6;">
              Votre demande d'identification d'entreprise a ete <strong>confirmee</strong>.
              Votre compte est maintenant actif.
            </p>
            <p style="margin:0 0 18px; line-height:1.6;">
              Vous pouvez acceder a votre espace personnel via le lien ci-dessous:
            </p>
            <p style="margin:0 0 18px;">
              <a href="${loginUrl}" style="display:inline-block; background:#0f766e; color:#fff; text-decoration:none; font-weight:700; padding:10px 16px; border-radius:8px;">
                Acceder a mon compte
              </a>
            </p>
            <p style="margin:0; color:#6b7280; font-size:13px;">
              Si vous n'etes pas a l'origine de cette demande, contactez le support ANAM.
            </p>
          </div>
        </div>
      </div>
    `,
  };
}

