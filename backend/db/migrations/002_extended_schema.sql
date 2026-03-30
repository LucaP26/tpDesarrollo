/*
  Extensiones necesarias para la app movil y el backoffice.
  No alteran ni renombran el esquema legado.
*/

IF OBJECT_ID('dbo.credencialesMoviles', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.credencialesMoviles (
        identificador INT NOT NULL IDENTITY,
        persona INT NOT NULL,
        email VARCHAR(250) NOT NULL,
        claveHash VARCHAR(500) NOT NULL,
        ultimoAcceso DATETIME2 NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'activo',
        CONSTRAINT pk_credencialesMoviles PRIMARY KEY (identificador),
        CONSTRAINT uq_credencialesMoviles_email UNIQUE (email),
        CONSTRAINT fk_credencialesMoviles_personas FOREIGN KEY (persona) REFERENCES dbo.personas (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.documentosClienteMovil', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.documentosClienteMovil (
        identificador INT NOT NULL IDENTITY,
        cliente INT NOT NULL,
        tipo VARCHAR(30) NOT NULL,
        urlArchivo VARCHAR(500) NOT NULL,
        fechaCarga DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT pk_documentosClienteMovil PRIMARY KEY (identificador),
        CONSTRAINT fk_documentosClienteMovil_clientes FOREIGN KEY (cliente) REFERENCES dbo.clientes (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.mediosDePago', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.mediosDePago (
        identificador INT NOT NULL IDENTITY,
        cliente INT NOT NULL,
        tipo VARCHAR(30) NOT NULL,
        moneda VARCHAR(3) NOT NULL CONSTRAINT chk_mediosDePago_moneda CHECK (moneda IN ('ARS', 'USD')),
        descripcion VARCHAR(250) NOT NULL,
        paisEmisor VARCHAR(3) NULL,
        ultimo4 VARCHAR(4) NULL,
        montoDisponible DECIMAL(18, 2) NOT NULL DEFAULT 0,
        estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        fechaAlta DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT pk_mediosDePago PRIMARY KEY (identificador),
        CONSTRAINT fk_mediosDePago_clientes FOREIGN KEY (cliente) REFERENCES dbo.clientes (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.verificacionesMediosDePago', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.verificacionesMediosDePago (
        identificador INT NOT NULL IDENTITY,
        medioPago INT NOT NULL,
        empleado INT NOT NULL,
        estado VARCHAR(20) NOT NULL,
        observaciones VARCHAR(500) NULL,
        fecha DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT pk_verificacionesMediosDePago PRIMARY KEY (identificador),
        CONSTRAINT fk_verificacionesMediosDePago_mediosDePago FOREIGN KEY (medioPago) REFERENCES dbo.mediosDePago (identificador),
        CONSTRAINT fk_verificacionesMediosDePago_empleados FOREIGN KEY (empleado) REFERENCES dbo.empleados (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.garantiasFondos', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.garantiasFondos (
        identificador INT NOT NULL IDENTITY,
        medioPago INT NOT NULL,
        montoReservado DECIMAL(18, 2) NOT NULL,
        montoConsumido DECIMAL(18, 2) NOT NULL DEFAULT 0,
        fechaDesde DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        fechaHasta DATETIME2 NULL,
        CONSTRAINT pk_garantiasFondos PRIMARY KEY (identificador),
        CONSTRAINT fk_garantiasFondos_mediosDePago FOREIGN KEY (medioPago) REFERENCES dbo.mediosDePago (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.configuracionSubastas', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.configuracionSubastas (
        identificador INT NOT NULL IDENTITY,
        subasta INT NOT NULL,
        moneda VARCHAR(3) NOT NULL CONSTRAINT chk_configuracionSubastas_moneda CHECK (moneda IN ('ARS', 'USD')),
        streamUrl VARCHAR(500) NULL,
        estadoStreaming VARCHAR(20) NOT NULL DEFAULT 'manual',
        permiteVisualizacion BIT NOT NULL DEFAULT 1,
        CONSTRAINT pk_configuracionSubastas PRIMARY KEY (identificador),
        CONSTRAINT uq_configuracionSubastas_subasta UNIQUE (subasta),
        CONSTRAINT fk_configuracionSubastas_subastas FOREIGN KEY (subasta) REFERENCES dbo.subastas (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.conexionesSubasta', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.conexionesSubasta (
        identificador INT NOT NULL IDENTITY,
        cliente INT NOT NULL,
        subasta INT NOT NULL,
        fechaIngreso DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        fechaEgreso DATETIME2 NULL,
        activa BIT NOT NULL DEFAULT 1,
        CONSTRAINT pk_conexionesSubasta PRIMARY KEY (identificador),
        CONSTRAINT fk_conexionesSubasta_clientes FOREIGN KEY (cliente) REFERENCES dbo.clientes (identificador),
        CONSTRAINT fk_conexionesSubasta_subastas FOREIGN KEY (subasta) REFERENCES dbo.subastas (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.notificacionesPrivadas', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.notificacionesPrivadas (
        identificador INT NOT NULL IDENTITY,
        persona INT NOT NULL,
        titulo VARCHAR(200) NOT NULL,
        mensaje VARCHAR(1000) NOT NULL,
        tipo VARCHAR(30) NOT NULL,
        leida BIT NOT NULL DEFAULT 0,
        fecha DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT pk_notificacionesPrivadas PRIMARY KEY (identificador),
        CONSTRAINT fk_notificacionesPrivadas_personas FOREIGN KEY (persona) REFERENCES dbo.personas (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.multasClientes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.multasClientes (
        identificador INT NOT NULL IDENTITY,
        cliente INT NOT NULL,
        importe DECIMAL(18, 2) NOT NULL,
        porcentaje DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
        vencimiento DATETIME2 NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'activa',
        motivo VARCHAR(500) NOT NULL,
        CONSTRAINT pk_multasClientes PRIMARY KEY (identificador),
        CONSTRAINT fk_multasClientes_clientes FOREIGN KEY (cliente) REFERENCES dbo.clientes (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.comprasSubasta', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.comprasSubasta (
        identificador INT NOT NULL IDENTITY,
        registroSubasta INT NULL,
        cliente INT NOT NULL,
        producto INT NOT NULL,
        medioPago INT NULL,
        moneda VARCHAR(3) NOT NULL CONSTRAINT chk_comprasSubasta_moneda CHECK (moneda IN ('ARS', 'USD')),
        importeMartillo DECIMAL(18, 2) NOT NULL,
        importeComision DECIMAL(18, 2) NOT NULL,
        importeEnvio DECIMAL(18, 2) NOT NULL DEFAULT 0,
        importeTotal DECIMAL(18, 2) NOT NULL,
        estadoPago VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        fecha DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT pk_comprasSubasta PRIMARY KEY (identificador),
        CONSTRAINT fk_comprasSubasta_registroDeSubasta FOREIGN KEY (registroSubasta) REFERENCES dbo.registroDeSubasta (identificador),
        CONSTRAINT fk_comprasSubasta_clientes FOREIGN KEY (cliente) REFERENCES dbo.clientes (identificador),
        CONSTRAINT fk_comprasSubasta_productos FOREIGN KEY (producto) REFERENCES dbo.productos (identificador),
        CONSTRAINT fk_comprasSubasta_mediosDePago FOREIGN KEY (medioPago) REFERENCES dbo.mediosDePago (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.enviosCompras', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.enviosCompras (
        identificador INT NOT NULL IDENTITY,
        compra INT NOT NULL,
        direccionEntrega VARCHAR(400) NOT NULL,
        costo DECIMAL(18, 2) NOT NULL,
        estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
        fechaDespacho DATETIME2 NULL,
        CONSTRAINT pk_enviosCompras PRIMARY KEY (identificador),
        CONSTRAINT fk_enviosCompras_comprasSubasta FOREIGN KEY (compra) REFERENCES dbo.comprasSubasta (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.retirosCompras', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.retirosCompras (
        identificador INT NOT NULL IDENTITY,
        compra INT NOT NULL,
        fechaRetiro DATETIME2 NOT NULL,
        pierdeCoberturaSeguro BIT NOT NULL DEFAULT 1,
        observaciones VARCHAR(500) NULL,
        CONSTRAINT pk_retirosCompras PRIMARY KEY (identificador),
        CONSTRAINT fk_retirosCompras_comprasSubasta FOREIGN KEY (compra) REFERENCES dbo.comprasSubasta (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.consignaciones', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.consignaciones (
        identificador INT NOT NULL IDENTITY,
        duenio INT NOT NULL,
        titulo VARCHAR(250) NOT NULL,
        descripcion VARCHAR(1000) NOT NULL,
        historia VARCHAR(2000) NULL,
        declaraPropiedad BIT NOT NULL,
        declaraOrigenLicitio BIT NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'enviada',
        fechaAlta DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        subastaAsignada INT NULL,
        precioBasePropuesto DECIMAL(18, 2) NULL,
        comisionPropuesta DECIMAL(18, 2) NULL,
        motivoRechazo VARCHAR(1000) NULL,
        CONSTRAINT pk_consignaciones PRIMARY KEY (identificador),
        CONSTRAINT fk_consignaciones_duenios FOREIGN KEY (duenio) REFERENCES dbo.duenios (identificador),
        CONSTRAINT fk_consignaciones_subastas FOREIGN KEY (subastaAsignada) REFERENCES dbo.subastas (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.fotosConsignacion', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.fotosConsignacion (
        identificador INT NOT NULL IDENTITY,
        consignacion INT NOT NULL,
        urlFoto VARCHAR(500) NOT NULL,
        orden INT NOT NULL,
        CONSTRAINT pk_fotosConsignacion PRIMARY KEY (identificador),
        CONSTRAINT fk_fotosConsignacion_consignaciones FOREIGN KEY (consignacion) REFERENCES dbo.consignaciones (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.revisionesConsignacion', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.revisionesConsignacion (
        identificador INT NOT NULL IDENTITY,
        consignacion INT NOT NULL,
        empleado INT NOT NULL,
        estado VARCHAR(20) NOT NULL,
        observaciones VARCHAR(1000) NULL,
        fecha DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT pk_revisionesConsignacion PRIMARY KEY (identificador),
        CONSTRAINT fk_revisionesConsignacion_consignaciones FOREIGN KEY (consignacion) REFERENCES dbo.consignaciones (identificador),
        CONSTRAINT fk_revisionesConsignacion_empleados FOREIGN KEY (empleado) REFERENCES dbo.empleados (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.ubicacionesProductos', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ubicacionesProductos (
        identificador INT NOT NULL IDENTITY,
        producto INT NOT NULL,
        ubicacion VARCHAR(250) NOT NULL,
        deposito VARCHAR(150) NULL,
        fecha DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        vigente BIT NOT NULL DEFAULT 1,
        CONSTRAINT pk_ubicacionesProductos PRIMARY KEY (identificador),
        CONSTRAINT fk_ubicacionesProductos_productos FOREIGN KEY (producto) REFERENCES dbo.productos (identificador)
    );
END;
GO

IF OBJECT_ID('dbo.detalleSeguroProductos', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.detalleSeguroProductos (
        identificador INT NOT NULL IDENTITY,
        producto INT NOT NULL,
        nroPoliza VARCHAR(30) NOT NULL,
        sumaAsegurada DECIMAL(18, 2) NOT NULL,
        coberturaAmpliada BIT NOT NULL DEFAULT 0,
        fecha DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT pk_detalleSeguroProductos PRIMARY KEY (identificador),
        CONSTRAINT fk_detalleSeguroProductos_productos FOREIGN KEY (producto) REFERENCES dbo.productos (identificador),
        CONSTRAINT fk_detalleSeguroProductos_seguros FOREIGN KEY (nroPoliza) REFERENCES dbo.seguros (nroPoliza)
    );
END;
GO

IF OBJECT_ID('dbo.vwHistorialPujos', 'V') IS NULL
EXEC('
CREATE VIEW dbo.vwHistorialPujos AS
SELECT
    s.identificador AS subastaId,
    i.identificador AS itemCatalogoId,
    p.identificador AS pujoId,
    a.cliente AS clienteId,
    p.importe,
    p.ganador
FROM dbo.pujos p
INNER JOIN dbo.asistentes a ON a.identificador = p.asistente
INNER JOIN dbo.itemsCatalogo i ON i.identificador = p.item
INNER JOIN dbo.catalogos c ON c.identificador = i.catalogo
INNER JOIN dbo.subastas s ON s.identificador = c.subasta
');
GO

IF OBJECT_ID('dbo.vwMetricasCliente', 'V') IS NULL
EXEC('
CREATE VIEW dbo.vwMetricasCliente AS
SELECT
    r.cliente AS clienteId,
    COUNT(*) AS comprasGanadas,
    SUM(r.importe) AS totalMartillo,
    SUM(r.comision) AS totalComision
FROM dbo.registroDeSubasta r
GROUP BY r.cliente
');
GO
