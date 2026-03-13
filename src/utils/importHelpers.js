import Papa from "papaparse";
import * as XLSX from "xlsx";
import { parseLocalYMD } from "./dateUtils";

export const rowsToActivities = (rows) => {
  const normalizeExcelDate = (value) => {
      if (!value) return "";

      // If already looks like YYYY-MM-DD, keep it
      if (typeof value === "string" && value.includes("-")) {
          return value.split("T")[0];
      }

      // If looks like M/D/YYYY, keep it
      if (typeof value === "string" && value.includes("/")) {
          return value;
      }

      // If Excel stored it as a serial number
      if (typeof value === "number") {
          const jsDate = XLSX.SSF.parse_date_code(value);
          if (!jsDate) return "";
          const yyyy = jsDate.y;
          const mm = String(jsDate.m).padStart(2, "0");
          const dd = String(jsDate.d).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}`;
      }

      return String(value);
  };

  return rows.map((row) => {
      return {
          id: crypto.randomUUID(),
          title: row.title || "",
          description: (row.description || "").replace(/\\n|;/g, "\n"),
          type: row.type || "run",
          intensity: row.intensity || "easy",
          feel: row.feel || "medium",
          date: normalizeExcelDate(row.date),
          time: row.time || "",
          mode: "timeMiles",
          duration: row.duration || "",
          miles: row.miles || "",
          splits: [{ mph: "", distance: "" }],
          notes: (row.notes || "").replace(/\\n|;/g, "\n"),
          photo: null,
      };
  });
  };


export const handleCSVImport = (file, activities, setActivities) => {
  Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
          const importedActivities = rowsToActivities(results.data);

          const updated = [...importedActivities, ...activities];
          updated.sort((a, b) => parseLocalYMD(b.date) - parseLocalYMD(a.date));

          setActivities(updated);
          localStorage.setItem("activities", JSON.stringify(updated));
      },
  });
};

export const handleExcelImport = async (file, activities, setActivities) => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rows = XLSX.utils.sheet_to_json(worksheet, {
            defval: "", // fills empty cells with ""
        });

        const importedActivities = rowsToActivities(rows);

        const updated = [...importedActivities, ...activities];
        updated.sort((a, b) => parseLocalYMD(b.date) - parseLocalYMD(a.date));

        setActivities(updated);
        localStorage.setItem("activities", JSON.stringify(updated));

        alert(`Imported ${importedActivities.length} activities from Excel ✅`);
    } catch (error) {
        console.error(error);
        alert("Failed to import Excel file.");
    }
};