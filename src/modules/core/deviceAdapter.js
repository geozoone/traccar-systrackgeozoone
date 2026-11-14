/**
 * Adaptador Maestro de Dispositivos y Permisos — GeoZoone GPS
 *
 * Fuente Única de Verdad (Single Source of Truth) para leer atributos de
 * vehículos, instalaciones y permisos sin importar si provienen de:
 * 1. Traccar Oficial (estándar)
 * 2. Capa legada brasileña (attributes.veiculo)
 * 3. Capa moderna GeoZoone (attributes.instalacion / attributes.bloqueoMotor)
 *
 * Todas las funciones son 100% seguras contra valores null / undefined.
 */

/**
 * Devuelve siempre un objeto plano de atributos válido.
 */
export const getSafeAttributes = (entity) => {
  if (!entity || typeof entity !== 'object') return {};
  if (!entity.attributes || typeof entity.attributes !== 'object') return {};
  return entity.attributes;
};

/**
 * Determina si el vehículo tiene instalado físicamente el relay de corte de motor.
 * Compatible con el formulario de instalación y con banderas directas.
 */
export const hasEngineCut = (device) => {
  const attrs = getSafeAttributes(device);

  if (attrs.bloqueoMotor === true || attrs.hasCut === true || attrs.relayInstalled === true) {
    return true;
  }

  const instalacion = attrs.instalacion && typeof attrs.instalacion === 'object' ? attrs.instalacion : {};
  if (instalacion.corteMotor) {
    const texto = String(instalacion.corteMotor).trim().toLowerCase();
    if (texto.startsWith('sí') || texto.startsWith('si') || texto === 'true' || texto === '1') {
      return true;
    }
  }

  return false;
};

/**
 * Extrae la información estandarizada del vehículo (Placa, Marca, Modelo, Año, Color).
 */
export const getVehicleInfo = (device) => {
  if (!device || typeof device !== 'object') {
    return {
      id: null,
      name: '',
      uniqueId: '',
      placa: '',
      marca: '',
      modelo: '',
      color: '',
      anio: '',
    };
  }

  const attrs = getSafeAttributes(device);
  const veiculo = attrs.veiculo && typeof attrs.veiculo === 'object' ? attrs.veiculo : {};

  return {
    id: device.id || null,
    name: device.name || '',
    uniqueId: device.uniqueId || '',
    placa: device.contact || veiculo.placa || attrs.placa || '',
    marca: veiculo.marca || attrs.marca || '',
    modelo: veiculo.modelo || device.model || attrs.modelo || '',
    color: veiculo.cor || veiculo.color || attrs.color || '',
    anio: veiculo.ano || veiculo.anio || attrs.anio || '',
  };
};

/**
 * Extrae los datos técnicos de la instalación física del GPS.
 */
export const getInstallationInfo = (device) => {
  const attrs = getSafeAttributes(device);
  const inst = attrs.instalacion && typeof attrs.instalacion === 'object' ? attrs.instalacion : {};

  return {
    corteMotor: inst.corteMotor || (hasEngineCut(device) ? 'Sí' : 'No'),
    lugarInstalacion: inst.lugarInstalacion || '',
    simCard: inst.simCard || device?.phone || '',
    operadorSim: inst.operadorSim || '',
    nombreInstalador: inst.nombreInstalador || '',
    fechaInstalacion: inst.fechaInstalacion || '',
  };
};

/**
 * Sincroniza los atributos del vehículo antes de guardar en DevicePage
 * para que las banderas rápidas (bloqueoMotor / hasCut) siempre coincidan
 * con lo seleccionado en la ficha de instalación.
 */
export const syncEngineCutAttributes = (attributes = {}) => {
  const safeAttrs = attributes && typeof attributes === 'object' ? { ...attributes } : {};
  const inst = safeAttrs.instalacion && typeof safeAttrs.instalacion === 'object' ? safeAttrs.instalacion : {};

  if (inst.corteMotor !== undefined) {
    const texto = String(inst.corteMotor).trim().toLowerCase();
    const tieneCorte = texto.startsWith('sí') || texto.startsWith('si');
    safeAttrs.bloqueoMotor = tieneCorte;
    safeAttrs.hasCut = tieneCorte;
  }

  return safeAttrs;
};

/**
 * Determina si el usuario actual puede ejecutar Comandos Rápidos Protegidos
 * (Apagar motor, Encender motor, Reiniciar GPS).
 * Usuarios en modo Solo Lectura ("el primo") quedan bloqueados.
 */
export const canExecuteQuickCommands = (user, deviceReadonly = false) => {
  if (!user || typeof user !== 'object') return false;
  if (deviceReadonly) return false;
  if (user.readonly === true || user.deviceReadonly === true) return false;
  return true;
};

/**
 * Determina si el usuario puede ver la pantalla completa de comandos crudos/avanzados.
 */
export const canAccessRawCommands = (user, deviceReadonly = false, limitCommands = false) => {
  if (!canExecuteQuickCommands(user, deviceReadonly)) return false;
  if (limitCommands === true || user?.limitCommands === true) return false;
  return true;
};

