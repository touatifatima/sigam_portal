import { useMemo, useState } from "react";
import { ArrowUpDown, Check, Copy, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Coordinate } from "@/components/arcgismap/ArcgisMap";
import styles from "./PerimeterCoordinatesTable.module.css";

type SortDirection = "asc" | "desc";

type CoordinateRow = {
  key: string;
  order: number;
  x: number;
  y: number;
  system: string;
  zone?: number;
  hemisphere?: string;
  originalIndex: number;
};

type PerimeterCoordinatesTableProps = {
  points: Coordinate[];
  title?: string;
  emptyMessage?: string;
  className?: string;
};

const formatCoordinate = (value: number): string => {
  if (!Number.isFinite(value)) return "--";
  return value.toFixed(6).replace(/\.?0+$/, "");
};

const formatSystem = (system?: string): string => {
  const raw = String(system || "").trim().toUpperCase();
  if (!raw) return "UTM";
  if (raw.includes("WGS")) return "WGS84";
  if (raw.includes("UTM")) return "UTM";
  if (raw.includes("LAMBERT")) return "LAMBERT";
  if (raw.includes("MERCATOR")) return "MERCATOR";
  return raw;
};

const copyText = async (value: string): Promise<boolean> => {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }

    if (typeof document === "undefined") return false;
    const el = document.createElement("textarea");
    el.value = value;
    el.setAttribute("readonly", "");
    el.style.position = "absolute";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
};

const resolveHemisphere = (row: CoordinateRow): string =>
  row.hemisphere || (row.system === "UTM" ? "N" : "--");

export default function PerimeterCoordinatesTable({
  points,
  title = "Coordonnees du perimetre",
  emptyMessage = "Aucun perimetre defini pour cette demande/permis.",
  className,
}: PerimeterCoordinatesTableProps) {
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [copied, setCopied] = useState<boolean>(false);

  const normalizedRows = useMemo<CoordinateRow[]>(() => {
    if (!Array.isArray(points) || points.length === 0) return [];

    return points
      .map((point, index) => {
        const parsedOrder = Number(point?.id);
        const order = Number.isFinite(parsedOrder) && parsedOrder > 0 ? parsedOrder : index + 1;
        const x = Number(point?.x);
        const y = Number(point?.y);

        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

        const parsedZone = Number(point?.zone);
        const zone = Number.isFinite(parsedZone) ? parsedZone : undefined;

        return {
          key: `${order}-${x}-${y}-${index}`,
          order,
          x,
          y,
          system: formatSystem(point?.system),
          zone,
          hemisphere: point?.hemisphere,
          originalIndex: index,
        } as CoordinateRow;
      })
      .filter((row): row is CoordinateRow => Boolean(row))
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.originalIndex - b.originalIndex;
      });
  }, [points]);

  const sortedRows = useMemo(() => {
    if (sortDirection === "asc") return normalizedRows;
    return [...normalizedRows].reverse();
  }, [normalizedRows, sortDirection]);

  const uniqueSystems = useMemo(
    () => Array.from(new Set(sortedRows.map((row) => row.system))),
    [sortedRows],
  );
  const uniqueHemispheres = useMemo(
    () => Array.from(new Set(sortedRows.map((row) => resolveHemisphere(row)))),
    [sortedRows],
  );
  const showSystemColumn = uniqueSystems.length > 1;
  const showHemisphereColumn = uniqueHemispheres.length > 1;
  const defaultSystem = uniqueSystems.length === 1 ? uniqueSystems[0] : null;
  const defaultHemisphere = uniqueHemispheres.length === 1 ? uniqueHemispheres[0] : null;
  const showDefaultSystemFact = !showSystemColumn && Boolean(defaultSystem);
  const showDefaultHemisphereFact =
    !showHemisphereColumn && Boolean(defaultHemisphere) && defaultHemisphere !== "--";
  const showTopFacts = showDefaultSystemFact || showDefaultHemisphereFact;

  const systemsLabel = useMemo(() => {
    if (uniqueSystems.length === 0) return "UTM/WGS84";
    return uniqueSystems.join(" | ");
  }, [uniqueSystems]);

  const handleToggleSort = () => {
    setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
  };

  const handleCopyCoordinates = async () => {
    if (sortedRows.length === 0) return;

    const header = ["ordre", "x", "y", "systeme", "zone", "hemisphere"].join(";");
    const rows = sortedRows.map((row) =>
      [
        row.order,
        formatCoordinate(row.x),
        formatCoordinate(row.y),
        row.system,
        row.zone ?? "",
        row.hemisphere ?? (row.system === "UTM" ? "N" : ""),
      ].join(";"),
    );
    const payload = [header, ...rows].join("\n");

    const ok = await copyText(payload);
    if (!ok) return;

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className={`${styles.wrapper} ${className || ""}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleIconWrap}>
            <MapPin className="w-4 h-4" />
          </div>
          <div className={styles.titleGroup}>
            <h4 className={styles.title}>{title}</h4>
            <p className={styles.subtitle}>
              {sortedRows.length > 0 ? `${sortedRows.length} points | ${systemsLabel}` : "UTM/WGS84"}
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          {sortedRows.length > 0 && (
            <span className={styles.metricBadge}>
              {sortDirection === "asc" ? "Ordre croissant" : "Ordre decroissant"}
            </span>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={styles.copyBtn}
            onClick={handleCopyCoordinates}
            disabled={sortedRows.length === 0}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copie" : "Copier les coordonnees"}
          </Button>
        </div>
      </div>
      {sortedRows.length > 0 && showTopFacts && (
        <div className={styles.topFacts}>
          {showDefaultSystemFact && defaultSystem && (
            <div className={styles.factItem}>
              <span>Systeme par defaut</span>
              <Badge
                variant="secondary"
                className={`${styles.systemBadge} ${
                  defaultSystem === "UTM"
                    ? styles.systemUtm
                    : defaultSystem === "WGS84"
                    ? styles.systemWgs
                    : styles.systemOther
                }`}
              >
                {defaultSystem}
              </Badge>
            </div>
          )}
          {showDefaultHemisphereFact && defaultHemisphere && (
            <div className={styles.factItem}>
              <span>Hemisphere</span>
              <Badge variant="secondary" className={styles.metaBadge}>
                {defaultHemisphere}
              </Badge>
            </div>
          )}
        </div>
      )}

      {sortedRows.length === 0 ? (
        <div className={styles.placeholder}>
          <MapPin className="w-5 h-5" />
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className={styles.tableScroll}>
          <Table className={styles.table}>
            <TableHeader className={styles.tableHeader}>
              <TableRow className={styles.headerRow}>
                <TableHead className={styles.headCell}>
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={handleToggleSort}
                    aria-label="Trier par numero"
                  >
                    No
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </TableHead>
                <TableHead className={styles.headCell}>X (Est / Longitude)</TableHead>
                <TableHead className={styles.headCell}>Y (Nord / Latitude)</TableHead>
                {showSystemColumn && <TableHead className={styles.headCell}>Systeme</TableHead>}
                <TableHead className={styles.headCell}>Zone</TableHead>
                {showHemisphereColumn && <TableHead className={styles.headCell}>Hemisphere</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row, index) => {
                const zoneLabel = Number.isFinite(row.zone as number) ? String(row.zone) : "--";
                const hemisphereLabel = resolveHemisphere(row);
                const systemBadgeClass =
                  row.system === "UTM"
                    ? styles.systemUtm
                    : row.system === "WGS84"
                    ? styles.systemWgs
                    : styles.systemOther;

                return (
                  <TableRow
                    key={row.key}
                    className={`${styles.bodyRow} ${index % 2 === 0 ? styles.rowEven : styles.rowOdd}`}
                  >
                    <TableCell className={`${styles.cell} ${styles.orderCell}`}>
                      <span className={styles.orderPill}>{row.order}</span>
                    </TableCell>
                    <TableCell className={`${styles.cell} ${styles.coordCell}`}>
                      {formatCoordinate(row.x)}
                    </TableCell>
                    <TableCell className={`${styles.cell} ${styles.coordCell}`}>
                      {formatCoordinate(row.y)}
                    </TableCell>
                    {showSystemColumn && (
                      <TableCell className={styles.cell}>
                        <Badge
                          variant="secondary"
                          className={`${styles.systemBadge} ${systemBadgeClass}`}
                        >
                          {row.system}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className={styles.cell}>
                      {zoneLabel === "--" ? (
                        zoneLabel
                      ) : (
                        <Badge variant="secondary" className={styles.metaBadge}>
                          {zoneLabel}
                        </Badge>
                      )}
                    </TableCell>
                    {showHemisphereColumn && (
                      <TableCell className={styles.cell}>
                        {hemisphereLabel === "--" ? (
                          hemisphereLabel
                        ) : (
                          <Badge variant="secondary" className={styles.metaBadge}>
                            {hemisphereLabel}
                          </Badge>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

