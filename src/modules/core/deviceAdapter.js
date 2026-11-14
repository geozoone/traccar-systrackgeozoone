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
 * Evalúa si el texto de corteMotor representa explícitamente que SÍ tiene corte.
 * Evita falsos positivos con "Sin Corte (Solo Rastreo)" o "Sin especificar".
 */
const isAffirmativeCutText = (value) => {
  if (!value) return false;
  const texto = String(value).trim().toLowerCase();
  if (!texto || texto.startsWith('sin') || texto.startsWith('no')) {
    return false;
  }
  return (
    texto.startsWith('sí')
    || texto === 'si'
    || texto.startsWith('si ')
    || texto.startsWith('si-')
    || texto.startsWith('si—')
    || texto.includes('⚡')
    || texto === 'true'
    || texto === '1'
  );
};

/**
 * Determina si el vehículo tiene instalado físicamente el relay de corte de motor.
 * Si en la ficha de instalación se eligió "Sin especificar" ("") o "Sin Corte (Solo Rastreo)",
 * devuelve estrictamente false.
 */
export const hasEngineCut = (device) => {
  const attrs = getSafeAttributes(device);
  const instalacion = attrs.instalacion && typeof attrs.instalacion === 'object' ? attrs.instalacion : {};

  // Si existe el campo corteMotor en la ficha de instalación, su valor manda
  if (instalacion.corteMotor !== undefined) {
    return isAffirmativeCutText(instalacion.corteMotor);
  }

  if (attrs.corteMotor !== undefined) {
    return isAffirmativeCutText(attrs.corteMotor);
  }

  return Boolean(
    attrs.bloqueoMotor === true
    || attrs.hasCut === true
    || attrs.relayInstalled === true
  );
};

/**
 * Extrae la información estandarizada del vehículo (Placa, Marca, Modelo, Año, Color).
 */
export const getVehicleInfo = (device) => {
  if (!device || typeof entity === 'undefined' && !device) {
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
    const tieneCorte = isAffirmativeCutText(inst.corteMotor);
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
