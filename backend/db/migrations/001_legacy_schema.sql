/*
  Esquema legado corregido para SQL Server.
  Fuente funcional: EstructuraActual.sql entregado por el usuario.
  Se preservan tablas, nombres y reglas conceptuales del archivo original.
  Los valores con typos del legado (por ejemplo "incativo" y "carrada")
  se mantienen para no alterar el contenido funcional existente.
*/

IF OBJECT_ID('dbo.paises', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.paises (
        numero INT NOT NULL,
        nombre VARCHAR(250) NOT NULL,
        nombreCorto VARCHAR(250) NULL,
        capital VARCHAR(250) NOT NULL,
        nacionalidad VARCHAR(250) NOT NULL,
        idiomas VARCHAR(150) NOT NULL,
        CONSTRAINT pk_paises PRIMARY KEY (numero)
    );
END;
GO

IF OBJECT_ID('dbo.personas', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.personas (
        identificador INT NOT NULL IDENTITY,
        documento VARCHAR(20) NOT NULL,
        nombre VARCHAR(150) NOT NULL,
        direccion VARCHAR(250) NULL,
        estado VARCHAR(15) CONSTRAINT chkEstado CHECK (estado IN ('activo', 'incativo')),
        foto VARBINARY(MAX) NULL,
        CONSTRAINT pk_personas PRIMARY KEY (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.empleados', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.empleados (
        identificador INT NOT NULL,
        cargo VARCHAR(100) NULL,
        sector INT NULL,
        CONSTRAINT pk_empleados PRIMARY KEY (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.sectores', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.sectores (
        identificador INT NOT NULL IDENTITY,
        nombreSector VARCHAR(150) NOT NULL,
        codigoSector VARCHAR(10) NULL,
        responsableSector INT NULL,
        CONSTRAINT pk_sectores PRIMARY KEY (identificador),
        CONSTRAINT fk_sectores_empleados FOREIGN KEY (responsableSector) REFERENCES dbo.empleados (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.seguros', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.seguros (
        nroPoliza VARCHAR(30) NOT NULL,
        compania VARCHAR(150) NOT NULL,
        polizaCombinada VARCHAR(2) CONSTRAINT chkpolizaCombinada CHECK (polizaCombinada IN ('si', 'no')),
        importe DECIMAL(18, 2) NOT NULL CONSTRAINT chkImporte CHECK (importe > 0),
        CONSTRAINT pk_seguro PRIMARY KEY (nroPoliza)
    );
END;
GO

IF OBJECT_ID('dbo.clientes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.clientes (
        identificador INT NOT NULL,
        numeroPais INT NULL,
        admitido VARCHAR(2) CONSTRAINT chkAdmitido CHECK (admitido IN ('si', 'no')),
        categoria VARCHAR(10) CONSTRAINT chkCategoria CHECK (categoria IN ('comun', 'especial', 'plata', 'oro', 'platino')),
        verificador INT NOT NULL,
        CONSTRAINT pk_clientes PRIMARY KEY (identificador),
        CONSTRAINT fk_clientes_personas FOREIGN KEY (identificador) REFERENCES dbo.personas (identificador),
        CONSTRAINT fk_clientes_empleados FOREIGN KEY (verificador) REFERENCES dbo.empleados (identificador),
        CONSTRAINT fk_clientes_paises FOREIGN KEY (numeroPais) REFERENCES dbo.paises (numero)
    );
END;
GO

IF OBJECT_ID('dbo.duenios', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.duenios (
        identificador INT NOT NULL,
        numeroPais INT NULL,
        verificacionFinanciera VARCHAR(2) CONSTRAINT chkVF CHECK (verificacionFinanciera IN ('si', 'no')),
        verificacionJudicial VARCHAR(2) CONSTRAINT chkVJ CHECK (verificacionJudicial IN ('si', 'no')),
        calificacionRiesgo INT CONSTRAINT chkCR CHECK (calificacionRiesgo IN (1, 2, 3, 4, 5, 6)),
        verificador INT NOT NULL,
        CONSTRAINT pk_duenios PRIMARY KEY (identificador),
        CONSTRAINT fk_duenios_personas FOREIGN KEY (identificador) REFERENCES dbo.personas (identificador),
        CONSTRAINT fk_duenios_empleados FOREIGN KEY (verificador) REFERENCES dbo.empleados (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.subastadores', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.subastadores (
        identificador INT NOT NULL,
        matricula VARCHAR(15) NULL,
        region VARCHAR(50) NULL,
        CONSTRAINT pk_subastadores PRIMARY KEY (identificador),
        CONSTRAINT fk_subastadores_personas FOREIGN KEY (identificador) REFERENCES dbo.personas (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.subastas', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.subastas (
        identificador INT NOT NULL IDENTITY,
        fecha DATE CONSTRAINT chkFecha CHECK (fecha > DATEADD(DAY, 10, GETDATE())),
        hora TIME NOT NULL,
        estado VARCHAR(10) CONSTRAINT chkES CHECK (estado IN ('abierta', 'carrada')),
        subastador INT NULL,
        ubicacion VARCHAR(350) NULL,
        capacidadAsistentes INT NULL,
        tieneDeposito VARCHAR(2) CONSTRAINT chkTD CHECK (tieneDeposito IN ('si', 'no')),
        seguridadPropia VARCHAR(2) CONSTRAINT chkSP CHECK (seguridadPropia IN ('si', 'no')),
        categoria VARCHAR(10) CONSTRAINT chkCS CHECK (categoria IN ('comun', 'especial', 'plata', 'oro', 'platino')),
        CONSTRAINT pk_subastas PRIMARY KEY (identificador),
        CONSTRAINT fk_subastas_subastadores FOREIGN KEY (subastador) REFERENCES dbo.subastadores (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.productos', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.productos (
        identificador INT NOT NULL IDENTITY,
        fecha DATE NULL,
        disponible VARCHAR(2) CONSTRAINT chkD CHECK (disponible IN ('si', 'no')),
        descripcionCatalogo VARCHAR(500) NULL CONSTRAINT df_productos_descripcionCatalogo DEFAULT 'No Posee',
        descripcionCompleta VARCHAR(300) NOT NULL,
        revisor INT NOT NULL,
        duenio INT NOT NULL,
        seguro VARCHAR(30) NULL,
        CONSTRAINT pk_productos PRIMARY KEY (identificador),
        CONSTRAINT fk_productos_empleados FOREIGN KEY (revisor) REFERENCES dbo.empleados (identificador),
        CONSTRAINT fk_productos_duenios FOREIGN KEY (duenio) REFERENCES dbo.duenios (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.fotos', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.fotos (
        identificador INT NOT NULL IDENTITY,
        producto INT NOT NULL,
        foto VARBINARY(MAX) NOT NULL,
        CONSTRAINT pk_fotos PRIMARY KEY (identificador),
        CONSTRAINT fk_fotos_productos FOREIGN KEY (producto) REFERENCES dbo.productos (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.catalogos', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.catalogos (
        identificador INT NOT NULL IDENTITY,
        descripcion VARCHAR(250) NOT NULL,
        subasta INT NULL,
        responsable INT NOT NULL,
        CONSTRAINT pk_catalogos PRIMARY KEY (identificador),
        CONSTRAINT fk_catalogos_empleados FOREIGN KEY (responsable) REFERENCES dbo.empleados (identificador),
        CONSTRAINT fk_catalogos_subastas FOREIGN KEY (subasta) REFERENCES dbo.subastas (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.itemsCatalogo', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.itemsCatalogo (
        identificador INT NOT NULL IDENTITY,
        catalogo INT NOT NULL,
        producto INT NOT NULL,
        precioBase DECIMAL(18, 2) NOT NULL CONSTRAINT chkPB CHECK (precioBase > 0.01),
        comision DECIMAL(18, 2) NOT NULL CONSTRAINT chkC CHECK (comision > 0.01),
        subastado VARCHAR(2) CONSTRAINT chkS CHECK (subastado IN ('si', 'no')),
        CONSTRAINT pk_itemsCatalogo PRIMARY KEY (identificador),
        CONSTRAINT fk_itemsCatalogo_catalogos FOREIGN KEY (catalogo) REFERENCES dbo.catalogos (identificador),
        CONSTRAINT fk_itemsCatalogo_productos FOREIGN KEY (producto) REFERENCES dbo.productos (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.asistentes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.asistentes (
        identificador INT NOT NULL IDENTITY,
        numeroPostor INT NOT NULL,
        cliente INT NOT NULL,
        subasta INT NOT NULL,
        CONSTRAINT pk_asistentes PRIMARY KEY (identificador),
        CONSTRAINT fk_asistentes_clientes FOREIGN KEY (cliente) REFERENCES dbo.clientes (identificador),
        CONSTRAINT fk_asistentes_subasta FOREIGN KEY (subasta) REFERENCES dbo.subastas (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.pujos', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.pujos (
        identificador INT NOT NULL IDENTITY,
        asistente INT NOT NULL,
        item INT NOT NULL,
        importe DECIMAL(18, 2) NOT NULL CONSTRAINT chkI CHECK (importe > 0.01),
        ganador VARCHAR(2) CONSTRAINT chkG CHECK (ganador IN ('si', 'no')) DEFAULT 'no',
        CONSTRAINT pk_pujos PRIMARY KEY (identificador),
        CONSTRAINT fk_pujos_asistentes FOREIGN KEY (asistente) REFERENCES dbo.asistentes (identificador),
        CONSTRAINT fk_pujos_itemsCatalogo FOREIGN KEY (item) REFERENCES dbo.itemsCatalogo (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.registroDeSubasta', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.registroDeSubasta (
        identificador INT NOT NULL IDENTITY,
        subasta INT NOT NULL,
        duenio INT NOT NULL,
        producto INT NOT NULL,
        cliente INT NOT NULL,
        importe DECIMAL(18, 2) NOT NULL CONSTRAINT chkImportePagado CHECK (importe > 0.01),
        comision DECIMAL(18, 2) NOT NULL CONSTRAINT chkComisionPagada CHECK (comision > 0.01),
        CONSTRAINT pk_registroDeSubasta PRIMARY KEY (identificador),
        CONSTRAINT fk_registroDeSubasta_subastas FOREIGN KEY (subasta) REFERENCES dbo.subastas (identificador),
        CONSTRAINT fk_registroDeSubasta_duenios FOREIGN KEY (duenio) REFERENCES dbo.duenios (identificador),
        CONSTRAINT fk_registroDeSubasta_producto FOREIGN KEY (producto) REFERENCES dbo.productos (identificador),
        CONSTRAINT fk_registroDeSubasta_cliente FOREIGN KEY (cliente) REFERENCES dbo.clientes (identificador)
    );
END;
GO
