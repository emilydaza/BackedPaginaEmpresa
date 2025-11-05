const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});


app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.query(
      'SELECT username, rol, grado, materias FROM usuarios WHERE username = $1 AND password = $2',
      [username, password]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    const usuario = result.rows[0];
    res.json(usuario);
  } catch (err) {
    console.error('❌ Error en login:', err);
    res.status(500).send('Error del servidor');
  }
});

app.post("/api/notas", async (req, res) => {
  const {
    nombre, grado, materia,
    examen1, examen2, examen_final,
    n1, n2, n3, n4,
    autoevaluacion, heteroevaluacion
  } = req.body;

  function limpiar(valor) {
    return valor === '' || valor === null || valor === undefined ? null : Number(valor);
  }

  const examen1Num = limpiar(examen1);
  const examen2Num = limpiar(examen2);
  const examenFinalNum = limpiar(examen_final);
  const n1Num = limpiar(n1);
  const n2Num = limpiar(n2);
  const n3Num = limpiar(n3);
  const n4Num = limpiar(n4);
  const autoevalNum = limpiar(autoevaluacion);
  const heteroevalNum = limpiar(heteroevaluacion);

  try {
    const existe = await db.query(
      "SELECT * FROM asignaciones_estudiantes WHERE nombre = $1 AND grado = $2 AND materia = $3",
      [nombre, grado, materia]
    );

    if (existe.rows.length > 0) {
      await db.query(
        `UPDATE asignaciones_estudiantes SET
          examen1 = $1, examen2 = $2, examen_final = $3,
          n1 = $4, n2 = $5, n3 = $6, n4 = $7,
          autoevaluacion = $8, heteroevaluacion = $9
        WHERE nombre = $10 AND grado = $11 AND materia = $12`,
        [
          examen1Num, examen2Num, examenFinalNum,
          n1Num, n2Num, n3Num, n4Num,
          autoevalNum, heteroevalNum,
          nombre, grado, materia
        ]
      );
      return res.json({ mensaje: "✅ Nota actualizada correctamente" });
    }

    await db.query(
      `UPDATE asignaciones_estudiantes SET examen1 = $1, examen2 = $2, examen_final = $3, n1 = $4, n2 = $5, n3 = $6, n4 = $7, autoevaluacion = $8, heteroevaluacion = $9 WHERE nombre = $10 AND grado = $11 AND materia = $12`,
      [
        examen1Num, examen2Num, examenFinalNum,
        n1Num, n2Num, n3Num, n4Num,
        autoevalNum, heteroevalNum,
        nombre, grado, materia
     ]
   );  


    res.status(201).json({ mensaje: "✅ Nota creada correctamente" });
  } catch (err) {
    console.error("❌ Error al guardar nota:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

app.get("/api/notas", async (req, res) => {
  const { nombre } = req.query;
  try {
    const result = await db.query("SELECT * FROM asignaciones_estudiantes WHERE nombre = $1", [nombre]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener notas:", err);
    res.status(500).send("Error del servidor");
  }
});

app.get('/api/notas/:grado', async (req, res) => {
  const grado = req.params.grado;
  try {
    const result = await db.query('SELECT * FROM asignaciones_estudiantes WHERE grado = $1', [grado]);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error al obtener notas por grado:', err);
    res.status(500).send('Error del servidor');
  }
});

app.get('/api/notas/:grado/:nombre', async (req, res) => {
  const { grado, nombre } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM asignaciones_estudiantes WHERE grado = $1 AND LOWER(nombre) = LOWER($2)',
      [grado, nombre]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error al obtener notas del estudiante:', err);
    res.status(500).send('Error del servidor');
  }
});

app.get("/api/notas-materia", async (req, res) => {
  const { nombre, materia } = req.query;
  try {
    const result = await db.query(
      "SELECT * FROM asignaciones_estudiantes WHERE nombre = $1 AND materia = $2",
      [nombre, materia]
    );
+   res.json(result.rows);
  } catch (err) {
    console.error("❌ Error al obtener asignaciones_estudiantes por materia:", err);
    res.status(500).send("Error del servidor");
  }
});

app.get('/api/grado/:nombre', async (req, res) => {
  const { nombre } = req.params;
  try {
    const result = await db.query(
      'SELECT grado FROM asignaciones_estudiantes WHERE nombre = $1 LIMIT 1',
      [nombre]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error al obtener grado del estudiante:', err);
    res.status(500).send('Error del servidor');
  }
});

app.get("/api/estudiantes/:grado", async (req, res) => {
  const { grado } = req.params;
  try {
    const result = await db.query(
      "SELECT DISTINCT nombre FROM asignaciones_estudiantes WHERE grado = $1",
      [grado]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error al obtener estudiantes por grado:", err);
    res.status(500).send("Error del servidor");
  }
});

app.get('/api/profesor/:username/materias', async (req, res) => {
  const { username } = req.params;
  try {
    const result = await db.query(
      'SELECT materias FROM usuarios WHERE username = $1 AND rol = $2',
      [username, 'profesor']
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profesor no encontrado' });
    }
    const materiasRaw = result.rows[0].materias || [];
    const materiasNormalizadas = materiasRaw.map(m =>
      m.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/-/g, " ").toLowerCase()
    );
    res.json({ materias: materiasNormalizadas });
  } catch (err) {
    console.error('❌ Error al obtener materias del profesor:', err);
    res.status(500).send('Error del servidor');
  }
});

app.get('/api/profesor/:username/materia/:materia', async (req, res) => {
  const { username, materia } = req.params;
  const materiaNormalizada = materia
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const result = await db.query(
    'SELECT grado FROM asignaciones WHERE LOWER(materia) = $1 AND profesor = $2',
    [materiaNormalizada, username]
  );

  const grados = result.rows.map(row => row.grado);
  res.json({ grados });
});



app.get('/api/usuarios', async (req, res) => {
  try {
    const result = await db.query('SELECT username, rol FROM usuarios');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error al obtener usuarios:', err);
    res.status(500).send('Error del servidor');
  }
});

app.post('/api/usuarios', async (req, res) => {
  const { username, password, rol } = req.body;
  try {
    await db.query(
      'INSERT INTO usuarios (username, password, rol) VALUES ($1, $2, $3)',
      [username, password, rol]
    );
    res.status(201).send('✅ Usuario creado');
  } catch (err) {
    console.error('❌ Error al crear usuario:', err);
    res.status(500).send('Error del servidor');
  }
});

app.delete('/api/usuarios/:username', async (req, res) => {
  const { username } = req.params;
  try {
    await db.query('DELETE FROM usuarios WHERE username = $1', [username]);
    res.send('🗑️ Usuario eliminado');
  } catch (err) {
    console.error('❌ Error al eliminar usuario:', err);
    res.status(500).send('Error del servidor');
  }
});

app.get("/api/estudiantes/:grado", async (req, res) => {
  const { grado } = req.params;
  try {
    const result = await db.query(
      "SELECT DISTINCT nombre FROM asignaciones_estudiantes WHERE grado = $1",
      [grado]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error al obtener estudiantes por grado:", err);
    res.status(500).send("Error del servidor");
  }
});

app.post("/api/tareas", async (req, res) => {
  const { grado, materia, descripcion, fecha_entrega, profesor } = req.body;
  try {
    await db.query(
      `INSERT INTO tareas (grado, materia, descripcion, fecha_entrega, profesor)
       VALUES ($1, $2, $3, $4, $5)`,
      [grado, materia, descripcion, fecha_entrega, profesor]
    );
    res.status(201).json({ mensaje: "✅ Tarea registrada" });
  } catch (err) {
    console.error("❌ Error al registrar tarea:", err);
    res.status(500).send("Error del servidor");
  }
});

app.get("/api/tareas/grado/:grado", async (req, res) => {
  const { grado } = req.params;
  const gradoLimpio = grado.trim().toLowerCase();

  try {
    const result = await db.query(
      `SELECT * FROM tareas WHERE LOWER(TRIM(grado)) = $1`,
      [gradoLimpio]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error al obtener tareas por grado:", err);
    res.status(500).send("Error del servidor");
  }
});


app.get("/api/tareas/grado/:grado", async (req, res) => {
  const { grado } = req.params;
  const gradoLimpio = grado.trim();

  try {
    const result = await db.query(
      `SELECT * FROM tareas WHERE TRIM(grado) = $1`,
      [gradoLimpio]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error al obtener tareas por grado:", err);
    res.status(500).send("Error del servidor");
  }
});



app.post("/api/opiniones", async (req, res) => {
  const { estudiante, profesor, materia, comentario, calificacion } = req.body;
  try {
    await db.query(
      `INSERT INTO opiniones (estudiante, profesor, materia, comentario, calificacion)
       VALUES ($1, $2, $3, $4, $5)`,
      [estudiante, profesor, materia, comentario, calificacion]
    );
    res.status(201).json({ mensaje: "✅ Opinión registrada" });
  } catch (err) {
    console.error("❌ Error al guardar opinión:", err);
    res.status(500).send("Error del servidor");
  }
});

app.get("/api/opiniones", async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM opiniones`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error al obtener opiniones:", err);
    res.status(500).send("Error del servidor");
  }
});

app.delete("/api/opiniones", async (req, res) => {
  try {
    await db.query("DELETE FROM opiniones");
    res.send("✅ Opiniones eliminadas correctamente");
  } catch (err) {
    console.error("❌ Error al borrar opiniones:", err);
    res.status(500).send("❌ Error al borrar opiniones");
  }
});

app.get("/api/estudiantes-por-grado", async (req, res) => {
  const grado = req.query.grado;

  console.log("📥 Grado recibido:", grado);

  try {
    if (!grado) {
      return res.status(400).json({ error: "Grado no proporcionado" });
    }

    const resultado = await db.query(
      "SELECT DISTINCT nombre FROM asignaciones_estudiantes WHERE grado = $1",
      [grado]
    );

    console.log("📤 Estudiantes encontrados:", resultado.rows);

    res.json(resultado.rows || []);
  } catch (err) {
    console.error("❌ Error real:", err.message);
    res.status(500).json({ error: "Error al obtener estudiantes", detalle: err.message });
  }
});

app.get("/api/materias-por-grado", async (req, res) => {
  const grado = req.query.grado;

  try {
    const resultado = await db.query(
      "SELECT materia, profesor, grado FROM asignaciones WHERE grado = $1",
      [grado]
    );
    res.json(resultado.rows);
  } catch (err) {
    console.error("❌ Error al obtener materias:", err);
    res.status(500).send("Error al obtener materias");
  }
});

app.get("/api/estudiante/:username/info", async (req, res) => {
  const username = req.params.username;

  try {
    const resultado = await db.query(
      "SELECT grado FROM usuarios WHERE username = $1",
      [username]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (err) {
    console.error("❌ Error al obtener info del estudiante:", err);
    res.status(500).send("Error del servidor");
  }
});



app.post("/api/guardar-nota", async (req, res) => {
  let { nombre, grado, materia, campo, valor } = req.body;

  console.log("📥 Datos recibidos:", req.body);

  const camposPermitidos = [
    "examen1", "examen2", "examen_final",
    "n1", "n2", "n3", "n4",
    "autoevaluacion", "heteroevaluacion"
  ];

  const campoNormalizado = campo?.toLowerCase().replace(/\s+/g, "_");

  if (!nombre || !grado || !materia || !campoNormalizado || valor === undefined) {
    console.log("❌ Datos incompletos:", req.body);
    return res.status(400).json({ error: "Datos incompletos" });
  }

  if (!camposPermitidos.includes(campoNormalizado)) {
    console.log("❌ Campo inválido:", campoNormalizado);
    return res.status(400).json({ error: "Campo inválido" });
  }

  const nombreClean = nombre.trim().toLowerCase();
  const gradoClean = grado.trim();
  const materiaClean = materia.trim().toLowerCase();

  try {
    const resultado = await db.query(
      `UPDATE asignaciones_estudiantes
       SET ${campoNormalizado} = $1
       WHERE LOWER(TRIM(nombre)) = $2 AND TRIM(grado) = $3 AND LOWER(TRIM(materia)) = $4`,
      [valor === "" || valor === null ? null : Number(valor), nombreClean, gradoClean, materiaClean]
    );

    console.log("🛠 UPDATE ejecutado:", {
      campo: campoNormalizado,
      valor,
      nombre: nombreClean,
      grado: gradoClean,
      materia: materiaClean,
      filasActualizadas: resultado.rowCount
    });

    if (resultado.rowCount === 0) {
      return res.status(404).json({ error: "Fila no encontrada" });
    }

    res.json({ ok: true, mensaje: `✅ ${campoNormalizado} guardado para ${nombre}` });
  } catch (err) {
    console.error("❌ Error al guardar nota:", err.message);
    res.status(500).json({ error: "Error al guardar nota" });
  }
});

app.get("/api/notas-por-profesor", async (req, res) => {
  const { grado, materia, profesor } = req.query;

  try {
    const resultado = await db.query(
      "SELECT nombre, examen1, examen2, examen_final, n1, n2, n3, n4, autoevaluacion, heteroevaluacion FROM asignaciones_estudiantes WHERE grado = $1 AND materia = $2 AND profesor = $3",
      [grado, materia, profesor]
    );

    res.json(resultado.rows || []);
  } catch (err) {
    console.error("❌ Error al obtener notas:", err.message);
    res.status(500).json({ error: "Error al obtener notas" });
  }
});

app.post("/api/notas", async (req, res) => {
  const {
    nombre,
    grado,
    materia,
    profesor,
    examen1,
    examen2,
    examen_final,
    n1,
    n2,
    n3,
    n4,
    autoevaluacion,
    heteroevaluacion
  } = req.body;

  const existe = await db.query(
    "SELECT * FROM asignaciones_estudiantes WHERE nombre = $1 AND grado = $2 AND materia = $3 AND profesor = $4",
    [nombre, grado, materia, profesor]
  );

  if (existe.rows.length > 0) {
    await db.query(
      `UPDATE asignaciones_estudiantes SET examen1=$5, examen2=$6, examen_final=$7, n1=$8, n2=$9, n3=$10, n4=$11, autoevaluacion=$12, heteroevaluacion=$13
       WHERE nombre=$1 AND grado=$2 AND materia=$3 AND profesor=$4`,
      [nombre, grado, materia, profesor, examen1, examen2, examen_final, n1, n2, n3, n4, autoevaluacion, heteroevaluacion]
    );
  } else {
    await db.query(
      `INSERT INTO asignaciones_estudiantes (nombre, grado, materia, profesor, examen1, examen2, examen_final, n1, n2, n3, n4, autoevaluacion, heteroevaluacion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [nombre, grado, materia, profesor, examen1, examen2, examen_final, n1, n2, n3, n4, autoevaluacion, heteroevaluacion]
    );
  }

  res.json({ mensaje: "✅ Nota guardada correctamente" });
});

app.get("/api/notas-por-profesor", async (req, res) => {
  const { grado, materia, profesor } = req.query;

  const resultado = await db.query(
    "SELECT * FROM asignaciones_estudiantes WHERE grado = $1 AND materia = $2 AND profesor = $3",
    [grado, materia, profesor]
  );

  res.json(resultado.rows);
});

app.get("/api/estudiantes-por-materia", async (req, res) => {
  const { grado, materia } = req.query;

  try {
    const resultado = await db.query(
      "SELECT nombre FROM asignaciones_estudiantes WHERE grado = $1 AND materia = $2",
      [grado, materia]
    );
    res.json(resultado.rows);
  } catch (err) {
    console.error("❌ Error al consultar estudiantes por materia:", err);
    res.status(500).json({ error: "Error al consultar estudiantes" });
  }
});

app.get("/api/notas-por-materia", async (req, res) => {
  const { grado, materia } = req.query;

  try {
    const resultado = await db.query(
      "SELECT * FROM asignaciones_estudiantes WHERE grado = $1 AND materia = $2",
      [grado, materia]
    );
    res.json(resultado.rows);
  } catch (err) {
    console.error("❌ Error al consultar notas por materia:", err);
    res.status(500).json({ error: "Error al consultar notas" });
  }
});

app.get("/api/estudiante/:nombre/grado", async (req, res) => {
  const { nombre } = req.params;

  try {
    const resultado = await db.query(
      "SELECT grado FROM asignaciones_estudiantes WHERE nombre = $1 LIMIT 1",
      [nombre]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    res.json({ grado: resultado.rows[0].grado });
  } catch (err) {
    console.error("❌ Error al obtener grado:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get("/api/materias-por-grado/:grado", async (req, res) => {
  const { grado } = req.params;

  try {
    const resultado = await db.query(
      "SELECT materia, profesor FROM asignaciones WHERE grado = $1",
      [grado]
    );

    res.json(resultado.rows);
  } catch (err) {
    console.error("❌ Error al obtener materias:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get("/api/asignaciones-estudiantes", async (req, res) => {
  const { grado, materia } = req.query;

  try {
    const resultado = await db.query(
      "SELECT * FROM asignaciones_estudiantes WHERE grado = $1 AND materia ILIKE $2",
      [grado, materia]
    );
    res.json(resultado.rows);
  } catch (err) {
    console.error("❌ Error al obtener asignaciones:", err);
    res.status(500).send("Error del servidor");
  }
});

const multer = require("multer");
const xlsx = require("xlsx");
const upload = multer({ dest: "uploads/" });

app.post("/api/usuarios/carga-masiva", upload.single("archivo"), async (req, res) => {
  console.log("Archivo recibido:", req.file);

  if (!req.file) {
    return res.status(400).send("❌ No se recibió ningún archivo");
  }

  try {
    const workbook = xlsx.readFile(req.file.path);
    const hoja = workbook.Sheets[workbook.SheetNames[0]];
    const datos = xlsx.utils.sheet_to_json(hoja);

    if (!Array.isArray(datos) || datos.length === 0) {
      return res.status(400).send("❌ El archivo está vacío o mal estructurado");
    }

    for (const fila of datos) {
      try {
        console.log("Procesando fila:", fila);

        const username = fila.username?.trim();
        const password = fila.password?.trim();
        const rol = fila.rol?.trim();
        const nombre = fila.nombre?.trim();
        const grado = fila.grado?.trim();

        if (!username || !password || !rol || !nombre || !grado) {
          console.log("❌ Fila incompleta:", fila);
          continue;
        }

        const existeUsuario = await db.query("SELECT * FROM usuarios WHERE username = $1", [username]);
        if (existeUsuario.rows.length === 0) {
          await db.query(
            "INSERT INTO usuarios (username, password, rol) VALUES ($1, $2, $3)",
            [username, password, rol]
          );
        }

        const materias = await db.query("SELECT nombre FROM materias_por_grado WHERE grado = $1", [grado]);

        if (!materias.rows || materias.rows.length === 0) {
          console.log(`⚠️ No se encontraron materias para el grado: ${grado}`);
          continue;
        }

        for (const materia of materias.rows) {
          const yaAsignado = await db.query(
            "SELECT * FROM asignaciones_estudiantes WHERE nombre = $1 AND grado = $2 AND materia = $3",
            [nombre, grado, materia.nombre]
          );

          if (yaAsignado.rows.length === 0) {
            await db.query(
              "INSERT INTO asignaciones_estudiantes (nombre, grado, materia) VALUES ($1, $2, $3)",
              [nombre, grado, materia.nombre]
            );
          }
        }
      } catch (filaError) {
        console.error("❌ Error procesando fila:", fila, filaError.message);
        continue;
      }
    }

    res.send("✅ Usuarios y asignaciones creados correctamente");
  } catch (error) {
    console.error("❌ Error en carga masiva:", error.stack || error.message || error);
    res.status(500).send("❌ Error al procesar el archivo");
  }
});

app.get("/api/notas-materia", async (req, res) => {
  const { nombre, materia } = req.query;
  console.log("🔍 Consultando notas para:", nombre, materia);


  try {
    const resultado = await db.query(
      `SELECT * FROM asignaciones_estudiantes WHERE nombre = $1 AND materia ILIKE $2`,
      [nombre, materia]
    );

   console.log("📤 Notas encontradas:", resultado.rows);
    res.json(resultado.rows);
  } catch (err) {
    console.error("❌ ERROR COMPLETO:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

app.put("/api/usuarios/:username", async (req, res) => {
  const { username } = req.params;
  const { username: nuevoNombre, password, rol } = req.body;

  try {
    await db.query(
      "UPDATE usuarios SET username = $1, password = $2, rol = $3 WHERE username = $4",
      [nuevoNombre, password, rol, username]
    );
    res.json({ mensaje: "✅ Usuario actualizado correctamente" });
  } catch (err) {
    console.error("❌ Error al actualizar usuario:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
});


app.listen(5000, () => {
  console.log("🚀 Servidor corriendo en puerto 5000");
});

module.exports = app;

