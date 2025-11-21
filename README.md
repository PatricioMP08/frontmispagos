# 📘 Frontend -- MiGasto Dashboard

**Next.js 14 • Axios • Recharts**

Este es el frontend del proyecto **MiGasto Dashboard**, una interfaz
donde el usuario puede visualizar y agregar transacciones conectadas a
un backend Lumen.

------------------------------------------------------------------------

## 🚀 Requisitos

-   Node.js 18+
-   npm o yarn

------------------------------------------------------------------------

## 📁 Estructura

    /lib/api.js
    /pages/index.js

------------------------------------------------------------------------

## ⚙️ Instalación

``` bash
npm install
```

------------------------------------------------------------------------

## ▶️ Modo desarrollo

``` bash
npm run dev
```

------------------------------------------------------------------------

## 🧩 Configuración Axios

``` js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
});

export default api;
```

------------------------------------------------------------------------

## 🔧 Scripts

  Script          Descripción
  --------------- --------------------
  npm run dev     Dev server
  npm run build   Build producción
  npm start       Ejecuta producción

------------------------------------------------------------------------

## 📄 Licencia

Libre para uso personal o educativo.
