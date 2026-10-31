// =================================================================
// Página de Registro de paciente nuevo.
// Conectada al endpoint POST /auth/register del backend.
// El backend fuerza el rol PACIENTE (UsuarioFactory.crearPaciente).
// =================================================================
import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

import { authApi, RegistroPayload } from '../../api/authApi';
import { Boton } from '../../components/common/Boton';
import { Input } from '../../components/common/Input';

export const Registro = () => {
    const navigate = useNavigate();

    const [form, setForm] = useState<RegistroPayload>({
        correo: '',
        contrasena: '',
        dni: '',
        nombres: '',
        apellidos: '',
        telefono: '',
        genero: 'Masculino',
        fecha_nacimiento: '',
        direccion: '',
    });

    const [confirmar, setConfirmar] = useState('');
    const [error, setError]         = useState<string | null>(null);
    const [cargando, setCargando]   = useState(false);
    const [exito, setExito]         = useState(false);

    const actualizar = (campo: keyof RegistroPayload, valor: string) => {
        setForm({ ...form, [campo]: valor });
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validación local
        if (form.contrasena !== confirmar) {
            setError('Las contraseñas no coinciden');
            return;
        }
        if (form.contrasena.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }
        if (form.dni.length !== 8) {
            setError('El DNI debe tener 8 dígitos');
            return;
        }

        setCargando(true);
        try {
            await authApi.register(form);
            setExito(true);

            // Después de 2 segundos, redirige al login
            setTimeout(() => navigate('/login'), 2000);
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                const msg = err.response?.data?.mensaje
                    || err.response?.data?.errors?.[0]?.constraints
                    || 'Error al registrar. Verifica tus datos.';
                setError(typeof msg === 'string' ? msg : 'Error al registrar.');
            } else {
                setError('Error inesperado. Intenta de nuevo.');
            }
        } finally {
            setCargando(false);
        }
    };

    // ===== Pantalla de éxito =====
    if (exito) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-soft via-blue-50 to-smoke">
                <div className="bg-white rounded-3xl shadow-card p-12 max-w-md text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-success flex items-center justify-center">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                            <path d="M5 12 L10 17 L19 8"
                                  stroke="white" strokeWidth="3"
                                  strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-extrabold text-blue-deep mb-2">¡Cuenta creada!</h2>
                    <p className="text-sm text-mute">Te estamos redirigiendo al login...</p>
                </div>
            </div>
        );
    }

    // ===== Formulario =====
    return (
        <div className="min-h-screen flex items-center justify-center py-10 bg-gradient-to-br from-sky-soft via-blue-50 to-smoke">
            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-card p-10">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-sky-main to-sky-deep flex items-center justify-center">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                            <path d="M5 12 L10 17 L19 8" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-extrabold text-blue-deep">Crear cuenta</h1>
                    <p className="text-xs text-mute mt-1">Regístrate como paciente para agendar tus citas</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Datos personales */}
                    <div>
                        <h3 className="text-xs font-bold text-sky-deep uppercase tracking-widest mb-3">Datos personales</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Nombres"
                                value={form.nombres}
                                onChange={(e) => actualizar('nombres', e.target.value)}
                                placeholder="Juan Carlos"
                                required
                            />
                            <Input
                                label="Apellidos"
                                value={form.apellidos}
                                onChange={(e) => actualizar('apellidos', e.target.value)}
                                placeholder="Pérez García"
                                required
                            />
                            <Input
                                label="DNI"
                                value={form.dni}
                                onChange={(e) => actualizar('dni', e.target.value.replace(/\D/g, ''))}
                                placeholder="76543210"
                                maxLength={8}
                                required
                            />
                            <Input
                                label="Teléfono"
                                value={form.telefono}
                                onChange={(e) => actualizar('telefono', e.target.value.replace(/\D/g, ''))}
                                placeholder="999888777"
                                maxLength={9}
                                required
                            />
                            {/* Género */}
                            <div>
                                <label className="block text-xs font-semibold text-ink-soft mb-2">Género</label>
                                <select
                                    value={form.genero}
                                    onChange={(e) => actualizar('genero', e.target.value as 'Masculino' | 'Femenino' | 'Otros')}
                                    className="w-full px-4 py-3 text-sm bg-white rounded-lg border border-gray-200 focus:border-sky-main outline-none"
                                >
                                    <option value="Masculino">Masculino</option>
                                    <option value="Femenino">Femenino</option>
                                    <option value="Otros">Otros</option>
                                </select>
                            </div>

                            <Input
                                label="Fecha de nacimiento"
                                type="date"
                                value={form.fecha_nacimiento}
                                onChange={(e) => actualizar('fecha_nacimiento', e.target.value)}
                            />
                        </div>

                        <div className="mt-3">
                            <Input
                                label="Dirección (opcional)"
                                value={form.direccion}
                                onChange={(e) => actualizar('direccion', e.target.value)}
                                placeholder="Av. Los Olivos 123, Lima"
                            />
                        </div>
                    </div>

                    <div className="h-px bg-gray-100 my-4" />

                    {/* Credenciales */}
                    <div>
                        <h3 className="text-xs font-bold text-sky-deep uppercase tracking-widest mb-3">Credenciales de acceso</h3>
                        <div className="space-y-3">
                            <Input
                                label="Correo electrónico"
                                type="email"
                                value={form.correo}
                                onChange={(e) => actualizar('correo', e.target.value)}
                                placeholder="juan@correo.com"
                                required
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="Contraseña"
                                    type="password"
                                    value={form.contrasena}
                                    onChange={(e) => actualizar('contrasena', e.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                    required
                                />
                                <Input
                                    label="Confirmar contraseña"
                                    type="password"
                                    value={confirmar}
                                    onChange={(e) => setConfirmar(e.target.value)}
                                    placeholder="Repite tu contraseña"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-danger-soft border border-danger-border rounded-lg">
                            <p className="text-xs text-danger font-semibold flex items-center gap-2">
                                <span>⚠</span> {error}
                            </p>
                        </div>
                    )}

                    {/* Botones */}
                    <div className="flex gap-3 pt-2">
                        <Boton
                            type="button"
                            variante="secondary"
                            onClick={() => navigate('/login')}
                            fullWidth
                        >
                            Cancelar
                        </Boton>
                        <Boton
                            type="submit"
                            disabled={cargando}
                            fullWidth
                        >
                            {cargando ? 'Creando cuenta...' : 'Crear cuenta →'}
                        </Boton>
                    </div>
                </form>

                {/* Footer */}
                <div className="text-center mt-6 pt-6 border-t border-gray-100">
                    <p className="text-sm text-mute">
                        ¿Ya tienes cuenta?{' '}
                        <Link to="/login" className="text-sky-main hover:text-sky-deep font-bold">
                            Iniciar sesión
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};