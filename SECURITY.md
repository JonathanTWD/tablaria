# Política de seguridad

## Versiones con soporte

Solo la última release publicada (la rama `main`, desplegada en [tablaria.es](https://tablaria.es)) recibe arreglos de seguridad.

## Cómo avisar de una vulnerabilidad

No abras un issue público. Usa una de estas dos vías:

1. **Recomendada:** la pestaña **Security → Report a vulnerability** de este repositorio, que abre un aviso privado en GitHub.
2. **Correo:** [privacidad@tablaria.es](mailto:privacidad@tablaria.es), con «Seguridad» en el asunto.

Incluye qué ocurre, los pasos para reproducirlo y su posible impacto. Si tienes una prueba de concepto, adjúntala. Te responderé en un plazo de 7 días, y te avisaré cuando esté corregido. Si quieres, aparecerás en las notas de la release.

## Alcance

**Dentro:** el código de este repositorio y la instancia de [tablaria.es](https://tablaria.es).

**Fuera:**
- ataques de denegación de servicio o de volumen;
- ingeniería social;
- informes de escáneres automáticos sin un impacto demostrado;
- vulnerabilidades de los proveedores externos (Render, Neon, Resend, Filebase y Groq), que se notifican a ellos.

Para probar, usa la demo o tu propia instalación local. No accedas a datos de otras cuentas ni los modifiques.
