export function validarPropiedad(form) {
  const errores = {}
  const vacio = value => value === '' || value === null || value === undefined || String(value).trim() === ''
  const error = (campo, mensaje) => { errores[campo] = [mensaje] }
  if (!Array.isArray(form.propietario_ids) || !form.propietario_ids.length) error('propietario_ids', 'Selecciona al menos un propietario.')
  if (vacio(form.sector_urbano_id)) error('sector_urbano_id', 'Selecciona un distrito y un sector urbano.')
  if (vacio(form.tipo)) error('tipo', 'Selecciona el tipo de propiedad.')
  if (!['USD', 'BOB'].includes(form.moneda)) error('moneda', 'Selecciona una moneda válida.')
  for (const [campo, nombre] of [['precio_venta', 'precio de venta'], ['superficie_m2', 'superficie del terreno']]) {
    if (vacio(form[campo])) error(campo, `Completa ${nombre}.`)
    else if (!Number.isFinite(Number(form[campo])) || Number(form[campo]) < 0) error(campo, `El valor de ${nombre} debe ser un número mayor o igual a cero.`)
  }
  for (const [campo, nombre] of [['frente_mts', 'frente'], ['fondo_mts', 'fondo'], ['superficie_construida_m2', 'superficie construida']]) {
    if (!vacio(form[campo]) && (!Number.isFinite(Number(form[campo])) || Number(form[campo]) < 0)) error(campo, `El valor de ${nombre} debe ser un número mayor o igual a cero.`)
  }
  for (const [campo, nombre] of [['habitaciones', 'habitaciones'], ['banos', 'baños']]) {
    if (!vacio(form[campo]) && (!Number.isInteger(Number(form[campo])) || Number(form[campo]) < 0)) error(campo, `El número de ${nombre} debe ser un entero mayor o igual a cero.`)
  }
  return errores
}

export function mensajeErrorPropiedad(error) {
  if (error.response?.status === 422) {
    const mensajes = Object.values(error.response.data?.errors ?? {}).flat()
    return mensajes.length ? mensajes.join('\n') : 'Revisa los datos del formulario.'
  }
  if (!error.response) return 'No se pudo conectar con el servidor. Comprueba tu conexión e intenta nuevamente.'
  if (error.response.status === 401) return 'Tu sesión ha caducado. Inicia sesión nuevamente.'
  if (error.response.status === 403) return 'No tienes permisos para guardar esta propiedad.'
  return 'El servidor no pudo guardar la propiedad. Intenta nuevamente; si el problema continúa, contacta al administrador.'
}
