import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Building2, Mail, MapPin, Phone } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import styles from "./contact.module.css";

type ContactOffice = {
  id: string;
  title: string;
  address: string;
  phone: string;
  fax?: string;
  email: string;
  lat: number;
  lng: number;
};

const offices: ContactOffice[] = [
  {
    id: "siege",
    title: "Direction Generale - Siege ANAM",
    address: "42 Chemin Mohamed Seghir Gacem, El Mouradia, Alger",
    phone: "+213 (0)23 48 81 25",
    fax: "+213 (0)23 48 81 24",
    email: "anam@anam.gov.dz",
    lat: 36.7538,
    lng: 3.0422,
  },
  {
    id: "boumerdes",
    title: "Antenne Regionale - Boumerdes",
    address: "Boulevard de l'ALN, Centre Villa de Boumerdes",
    phone: "024 79 10 41",
    fax: "024 79 10 43",
    email: "anam-boumerdes@anam.gov.dz",
    lat: 36.7667,
    lng: 3.4833,
  },
  {
    id: "oran",
    title: "Antenne Regionale - Oran",
    address: "Cite Jordaine n 46, 2eme etage, Les Castors, Oran",
    phone: "041 46 26 48",
    fax: "041 45 52 76",
    email: "anam-oran@anam.gov.dz",
    lat: 35.6971,
    lng: -0.6308,
  },
  {
    id: "tebessa",
    title: "Antenne Regionale - Tebessa",
    address: "Zone urbaine n 02, quartier El Djorf, Tebessa",
    phone: "037 47 49 15",
    fax: "037 47 48 97",
    email: "anam-tebessa@anam.gov.dz",
    lat: 35.4042,
    lng: 8.1242,
  },
  {
    id: "bechar",
    title: "Antenne Regionale - Bechar",
    address: "Hai El Djihani n 11, Lot 49, Bechar",
    phone: "049 23 07 90",
    fax: "049 23 08 91",
    email: "anam-bechar@anam.gov.dz",
    lat: 31.6167,
    lng: -2.2167,
  },
  {
    id: "ouargla",
    title: "Antenne Regionale - Ouargla",
    address: "Cite 460 Logts, Rue Larbi Ben M'hidi, Mekhadma, Ouargla",
    phone: "029 71 18 16",
    email: "anam-ouargla@anam.gov.dz",
    lat: 31.9539,
    lng: 5.3326,
  },
  {
    id: "tamanrasset",
    title: "Antenne Regionale - Tamanrasset",
    address: "Sonarem-ORGM, Gattaa El Oued, Tamanrasset",
    phone: "029 32 45 04",
    fax: "029 32 45 04",
    email: "anam-tamanrasset@anam.gov.dz",
    lat: 22.785,
    lng: 5.5228,
  },
];

export default function ContactPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: false,
    }).setView([28.163, 2.632], 5);
    mapInstanceRef.current = map;

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const bounds: L.LatLngTuple[] = [];
    offices.forEach((office) => {
      const latlng: L.LatLngTuple = [office.lat, office.lng];
      bounds.push(latlng);

      L.circleMarker(latlng, {
        radius: 8,
        weight: 2,
        color: "#7a365f",
        fillColor: "#b14680",
        fillOpacity: 0.92,
      })
        .addTo(map)
        .bindPopup(
          `<strong>${office.title}</strong><br/>${office.address}<br/>Tel: ${office.phone}`,
        );
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [26, 26] });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const totalDirections = useMemo(() => offices.length, []);

  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={`container ${styles.heroInner}`}>
            <div className={styles.heroBadge}>Contact officiel</div>
            <h1>Contact et directions ANAM</h1>
            <p>
              Retrouvez les coordonnees du siege ANAM et des principales antennes
              regionales. La carte ci-dessous vous aide a localiser rapidement chaque
              direction.
            </p>
            <div className={styles.actions}>
              <Link href="/acceuil/Home" className={styles.primaryCta}>
                Retour accueil
              </Link>
              <a href="mailto:anam@anam.gov.dz" className={styles.secondaryCta}>
                Envoyer un e-mail
              </a>
            </div>
          </div>
        </section>

        <section className={`container ${styles.statsBar}`}>
          <div className={styles.statPill}>
            <Building2 size={16} />
            <span>{totalDirections} directions affichees</span>
          </div>
          <div className={styles.statPill}>
            <Phone size={16} />
            <span>Standard ANAM: +213 (0)23 48 81 25</span>
          </div>
          <div className={styles.statPill}>
            <Mail size={16} />
            <span>anam@anam.gov.dz</span>
          </div>
        </section>

        <section className={`container ${styles.cardsSection}`}>
          <div className={styles.cardsGrid}>
            {offices.map((office) => {
              const mapHref = `https://www.google.com/maps?q=${office.lat},${office.lng}`;
              return (
                <article key={office.id} className={styles.contactCard}>
                  <h2>{office.title}</h2>
                  <div className={styles.lineItem}>
                    <MapPin size={15} />
                    <span>{office.address}</span>
                  </div>
                  <div className={styles.lineItem}>
                    <Phone size={15} />
                    <span>
                      Tel/Fax: {office.phone}
                      {office.fax ? ` - ${office.fax}` : ""}
                    </span>
                  </div>
                  <div className={styles.lineItem}>
                    <Mail size={15} />
                    <a href={`mailto:${office.email}`}>{office.email}</a>
                  </div>
                  <a
                    href={mapHref}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.mapLink}
                  >
                    Voir sur la carte
                  </a>
                </article>
              );
            })}
          </div>
        </section>

        <section className={`container ${styles.mapSection}`}>
          <div className={styles.mapHeader}>
            <h3>Localisation des directions</h3>
            <p>Carte interactive des antennes ANAM sur le territoire national.</p>
          </div>
          <div ref={mapRef} className={styles.map} />
        </section>
      </main>

      <Footer />
    </div>
  );
}
