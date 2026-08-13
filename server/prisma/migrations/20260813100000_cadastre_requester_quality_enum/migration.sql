CREATE TYPE "QualiteDemandeurCadastre" AS ENUM (
  'REPRESENTANT_LEGAL',
  'ACTIONNAIRE',
  'TITULAIRE_TITRE_MINIER'
);

ALTER TABLE "demandes_documents_cadastraux"
  ALTER COLUMN "qualiteDemandeur" TYPE "QualiteDemandeurCadastre"
  USING (
    CASE lower(trim("qualiteDemandeur"))
      WHEN 'actionnaire' THEN 'ACTIONNAIRE'::"QualiteDemandeurCadastre"
      WHEN 'titulaire du titre minier' THEN 'TITULAIRE_TITRE_MINIER'::"QualiteDemandeurCadastre"
      WHEN 'titulaire titre minier' THEN 'TITULAIRE_TITRE_MINIER'::"QualiteDemandeurCadastre"
      ELSE 'REPRESENTANT_LEGAL'::"QualiteDemandeurCadastre"
    END
  );
