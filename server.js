const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const archivoDatos = path.join(__dirname, "data", "destinos.json");

// Destinos iniciales de la aplicación.
const datosIniciales = {
  destinos: [
    {
      nombre: "Cancún",
      emoji: "🏖️",
      descripcion: "Playas turquesa, sol y aventura.",
      votos: 0
    },
    {
      nombre: "Oaxaca",
      emoji: "🌵",
      descripcion: "Cultura, gastronomía y tradición.",
      votos: 0
    },
    {
      nombre: "Puerto Vallarta",
      emoji: "🌅",
      descripcion: "Mar, atardeceres y diversión.",
      votos: 0
    }
  ],
  actividad: []
};

// Carga votos anteriores; si no existen, crea el estado inicial.
function cargarDatos() {
  try {
    return JSON.parse(fs.readFileSync(archivoDatos, "utf8"));
  } catch {
    return JSON.parse(JSON.stringify(datosIniciales));
  }
}

let datos = cargarDatos();

// Guarda los votos para conservarlos aunque se reinicie Node.
function guardarDatos() {
  fs.mkdirSync(path.dirname(archivoDatos), { recursive: true });
  fs.writeFileSync(archivoDatos, JSON.stringify(datos, null, 2));
}

function resumen() {
  const total = datos.destinos.reduce((suma, destino) => suma + destino.votos, 0);

  const lider = [...datos.destinos].sort((a, b) => b.votos - a.votos)[0];

  return {
    destinos: datos.destinos,
    actividad: datos.actividad,
    total,
    lider
  };
}

function actualizarClientes() {
  io.emit("estado", resumen());
}

app.use(express.static(path.join(__dirname, "public")));

// Pequeña API para consultar los resultados como JSON.
app.get("/api/resumen", (req, res) => {
  res.json(resumen());
});

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  socket.emit("estado", resumen());
  io.emit("usuarios", io.engine.clientsCount);

  socket.on("votar", (nombre) => {
    const destino = datos.destinos.find((item) => item.nombre === nombre);

    if (!destino) {
      socket.emit("mensaje", "El destino no existe.");
      return;
    }

    destino.votos++;

    datos.actividad.unshift({
      texto: `Alguien votó por ${destino.nombre}`,
      hora: new Date().toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit"
      })
    });

    datos.actividad = datos.actividad.slice(0, 6);

    guardarDatos();
    actualizarClientes();
  });

  socket.on("agregar-destino", (nuevoDestino) => {
    const nombre = String(nuevoDestino.nombre || "").trim().slice(0, 30);
    const yaExiste = datos.destinos.some(
      (item) => item.nombre.toLowerCase() === nombre.toLowerCase()
    );

    if (nombre.length < 3 || yaExiste) {
      socket.emit("mensaje", "Escribe un destino único de al menos 3 letras.");
      return;
    }

    datos.destinos.push({
      nombre,
      emoji: String(nuevoDestino.emoji || "✈️").trim().slice(0, 4) || "✈️",
      descripcion:
        String(nuevoDestino.descripcion || "Propuesto por la tripulación.")
          .trim()
          .slice(0, 70),
      votos: 0
    });

    datos.actividad.unshift({
      texto: `${nombre} se agregó a la votación`,
      hora: new Date().toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit"
      })
    });

    datos.actividad = datos.actividad.slice(0, 6);

    guardarDatos();
    actualizarClientes();
  });

  socket.on("reiniciar-votos", () => {
    datos.destinos.forEach((destino) => {
      destino.votos = 0;
    });

    datos.actividad.unshift({
      texto: "La votación fue reiniciada",
      hora: new Date().toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit"
      })
    });

    guardarDatos();
    actualizarClientes();
  });

  socket.on("disconnect", () => {
    io.emit("usuarios", io.engine.clientsCount);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor listo en http://localhost:${PORT}`);
});