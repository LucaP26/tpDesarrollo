import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { API_BASE_URL, SERVER_BASE_URL, api } from './src/api';
import { appAssets, imageSource } from './src/assets';
import {
  AuctionCard,
  AvatarButton,
  BrandTitle,
  Field,
  FooterNav,
  GhostButton,
  Header,
  LotCard,
  PrimaryButton,
  categoryLabel,
  money,
} from './src/components';
import { colors, fonts, spacing } from './src/theme';

const demoCredentials = {
  email: 'm@gmail.com',
  password: 'Platino123!',
};

export default function App() {
  const [stack, setStack] = useState([{ name: 'splash', params: {} }]);
  const [auth, setAuth] = useState({ token: null, user: null });
  const route = stack[stack.length - 1];

  useEffect(() => {
    function openPasswordSetup(url) {
      const params = passwordSetupParams(url);
      if (params) {
        replace('setPassword', params);
      }
    }

    Linking.getInitialURL().then((url) => {
      if (url) {
        openPasswordSetup(url);
      }
    });
    const subscription = Linking.addEventListener('url', ({ url }) => openPasswordSetup(url));
    return () => subscription.remove();
  }, []);

  function navigate(name, params = {}) {
    setStack((current) => [...current, { name, params }]);
  }

  function replace(name, params = {}) {
    setStack([{ name, params }]);
  }

  function goBack() {
    setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }

  function goTab(tab) {
    const map = {
      home: 'home',
      discover: 'discover',
      watchlist: 'watchlist',
      bids: 'bids',
    };
    replace(map[tab] || 'home');
  }

  const commonProps = {
    auth,
    setAuth,
    navigate,
    replace,
    goBack,
    goTab,
  };

  return (
    <>
      <StatusBar style="light" />
      {route.name === 'splash' && <SplashScreen replace={replace} />}
      {route.name === 'login' && <LoginScreen {...commonProps} />}
      {route.name === 'register' && <RegisterScreen {...commonProps} />}
      {route.name === 'setPassword' && <SetPasswordScreen {...commonProps} params={route.params} />}
      {route.name === 'home' && <HomeScreen {...commonProps} />}
      {route.name === 'discover' && <DiscoverScreen {...commonProps} />}
      {route.name === 'publicDiscover' && <DiscoverScreen {...commonProps} publicMode />}
      {route.name === 'watchlist' && <WatchlistScreen {...commonProps} />}
      {route.name === 'bids' && <BidsScreen {...commonProps} />}
      {route.name === 'auctionRoom' && <AuctionRoomScreen {...commonProps} auctionId={route.params.auctionId} />}
      {route.name === 'publicAuctionRoom' && <AuctionRoomScreen {...commonProps} auctionId={route.params.auctionId} publicMode />}
      {route.name === 'profile' && <ProfileScreen {...commonProps} />}
      {route.name === 'consignments' && <ConsignmentScreen {...commonProps} />}
    </>
  );
}

function SplashScreen({ replace }) {
  useEffect(() => {
    const timeout = setTimeout(() => replace('login'), 1000);
    return () => clearTimeout(timeout);
  }, [replace]);

  return (
    <Pressable style={styles.fill} onPress={() => replace('login')}>
      <ImageBackground source={appAssets.splash} resizeMode="cover" style={styles.fill}>
        <View style={styles.splashShade}>
          <Text style={styles.enterGallery}>ENTER GALLERY</Text>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

function LoginScreen({ setAuth, replace, navigate }) {
  const [email, setEmail] = useState(demoCredentials.email);
  const [password, setPassword] = useState(demoCredentials.password);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.includes('@')) {
      Alert.alert('Mail inválido', 'El correo electrónico debe contener @.');
      return;
    }
    if (!password) {
      Alert.alert('Contraseña obligatoria', 'Ingresá tu contraseña para continuar.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.login(email.trim().toLowerCase(), password);
      setAuth({ token: response.access_token, user: response.user });
      replace('home');
    } catch (error) {
      Alert.alert('No se pudo iniciar sesión', error.message || 'No pudimos conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="handled">
          <BrandTitle size={34} />
          <Text style={styles.loginTitle}>Acceso privado</Text>
          <Text style={styles.loginCopy}>Entrá a ATELIER, subastas exclusivas y coleccionables de alto valor.</Text>

          <View style={styles.panel}>
            <Field label="CORREO ELECTRÓNICO" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <Field label="CONTRASEÑA" value={password} onChangeText={setPassword} secureTextEntry />
            <PrimaryButton label={loading ? 'INGRESANDO...' : 'ENTRAR A LA PLATAFORMA'} onPress={submit} disabled={loading} />
            <GhostButton label="VER CATALOGOS PUBLICOS" onPress={() => navigate('publicDiscover')} style={styles.topSpace} />
            <GhostButton label="SOLICITAR REGISTRO" onPress={() => navigate('register')} style={styles.topSpace} />
            <GhostButton label="CREAR CONTRASENA CON TOKEN" onPress={() => navigate('setPassword')} style={styles.compactTopSpace} />
            <Text style={styles.apiHint}>API: {API_BASE_URL}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function RegisterScreen({ goBack, replace }) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    document_number: '',
    birth_date: '',
    legal_address: '',
    country_iso: 'AR',
  });
  const [frontDoc, setFrontDoc] = useState(null);
  const [backDoc, setBackDoc] = useState(null);
  const [loading, setLoading] = useState(false);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function pickDocument(side) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Galeria requerida', 'Necesitamos adjuntar frente y dorso del documento.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) {
      return;
    }
    const dataUrl = imageAssetToDataUrl(result.assets[0]);
    if (side === 'front') {
      setFrontDoc(dataUrl);
    } else {
      setBackDoc(dataUrl);
    }
  }

  async function submit() {
    const email = form.email.trim().toLowerCase();
    const documentNumber = form.document_number.trim();
    const countryIso = form.country_iso.trim().toUpperCase() || 'AR';
    if (!form.first_name.trim() || !form.last_name.trim() || !email || !documentNumber || !form.legal_address.trim()) {
      Alert.alert('Faltan datos', 'Completa nombre, apellido, mail, documento y domicilio legal.');
      return;
    }
    if (!email.includes('@')) {
      Alert.alert('Mail invalido', 'Ingresa un correo electronico valido.');
      return;
    }
    if (!isAdultBirthDate(form.birth_date)) {
      Alert.alert('Fecha invalida', 'Ingresa una fecha AAAA-MM-DD de una persona mayor de 18 anos.');
      return;
    }
    if (!frontDoc || !backDoc) {
      Alert.alert('Documento requerido', 'Adjunta frente y dorso del documento.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.registerOnboarding({
        email,
        document_number: documentNumber,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        gender: 'otro',
        birth_date: form.birth_date.trim(),
        legal_address: form.legal_address.trim(),
        country_code: encodeCountryCode(countryIso),
        roles: ['cliente', 'duenio'],
        document_front_image_url: frontDoc,
        document_back_image_url: backDoc,
      });
      Alert.alert('Solicitud recibida', response.message || 'La empresa revisara tus datos antes de aprobar el acceso.', [
        { text: 'OK', onPress: () => replace('login') },
      ]);
    } catch (error) {
      Alert.alert('No pudimos enviar la solicitud', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.contentWithFooter} keyboardShouldPersistTaps="handled">
          <Header title="Registro" onBack={goBack} />
          <View style={styles.panel}>
            <Field label="NOMBRE" value={form.first_name} onChangeText={(value) => setField('first_name', value)} />
            <Field label="APELLIDO" value={form.last_name} onChangeText={(value) => setField('last_name', value)} />
            <Field label="CORREO" value={form.email} onChangeText={(value) => setField('email', value)} keyboardType="email-address" />
            <Field label="DOCUMENTO" value={form.document_number} onChangeText={(value) => setField('document_number', value)} />
            <Field label="FECHA NACIMIENTO" value={form.birth_date} onChangeText={(value) => setField('birth_date', value)} placeholder="AAAA-MM-DD" />
            <Field label="DOMICILIO LEGAL" value={form.legal_address} onChangeText={(value) => setField('legal_address', value)} />
            <Field label="PAIS DE ORIGEN" value={form.country_iso} onChangeText={(value) => setField('country_iso', value.toUpperCase().slice(0, 2))} />
            <GhostButton label={frontDoc ? 'FRENTE CARGADO' : 'CARGAR FRENTE'} onPress={() => pickDocument('front')} />
            <GhostButton label={backDoc ? 'DORSO CARGADO' : 'CARGAR DORSO'} onPress={() => pickDocument('back')} style={styles.compactTopSpace} />
            <PrimaryButton label={loading ? 'ENVIANDO...' : 'ENVIAR SOLICITUD'} onPress={submit} disabled={loading} style={styles.topSpace} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function SetPasswordScreen({ setAuth, replace, goBack, params = {} }) {
  const [email, setEmail] = useState(params.email || '');
  const [token, setToken] = useState(params.token || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !token.trim()) {
      Alert.alert('Datos obligatorios', 'Ingresa el mail y el token de activacion.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Contrasenas distintas', 'Revisa la confirmacion de contrasena.');
      return;
    }
    if (!isStrongPassword(password)) {
      Alert.alert('Contrasena debil', 'Usa mayuscula, minuscula, numero, simbolo y al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.completePasswordSetup(email.trim().toLowerCase(), token.trim(), password);
      setAuth({ token: response.access_token, user: response.user });
      replace('home');
    } catch (error) {
      Alert.alert('No pudimos activar la cuenta', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="handled">
          <BrandTitle size={30} />
          <Text style={styles.loginTitle}>Crear contrasena</Text>
          <Text style={styles.loginCopy}>Usa el enlace o token recibido despues de la aprobacion de la empresa.</Text>
          <View style={styles.panel}>
            <Field label="CORREO" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <Field label="TOKEN" value={token} onChangeText={setToken} />
            <Field label="CONTRASENA" value={password} onChangeText={setPassword} secureTextEntry />
            <Field label="CONFIRMAR CONTRASENA" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
            <PrimaryButton label={loading ? 'ACTIVANDO...' : 'CREAR ACCESO'} onPress={submit} disabled={loading} />
            <GhostButton label="VOLVER" onPress={goBack} style={styles.topSpace} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function HomeScreen({ auth, navigate, replace, goTab }) {
  const [auctions, setAuctions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [auctionData, notificationData] = await Promise.all([
          api.auctions(auth.token),
          api.notifications(auth.token).catch(() => []),
        ]);
        if (active) {
          setAuctions(auctionData || []);
          setNotifications(notificationData || []);
        }
      } catch (error) {
        Alert.alert('No pudimos cargar inicio', error.message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [auth.token]);

  const featured = auctions.slice(0, 2);

  async function toggleHomeWatchlist(auction) {
    if (auction.state !== 'programada') {
      Alert.alert(
        'No se puede guardar',
        'Solo podés agregar a tu watchlist subastas programadas. Las subastas en vivo no pueden guardarse.'
      );
      return;
    }

    try {
      if (auction.in_watchlist) {
        await api.removeWatchlist(auth.token, auction.id);
      } else {
        await api.addWatchlist(auth.token, auction.id);
      }
      setAuctions((items) =>
        items.map((item) => (item.id === auction.id ? { ...item, in_watchlist: !item.in_watchlist } : item))
      );
    } catch (error) {
      Alert.alert('No pudimos actualizar watchlist', error.message);
    }
  }

  return (
    <Screen footer={<FooterNav active="home" onNavigate={goTab} />}>
      <ScrollView contentContainerStyle={styles.contentWithFooter}>
        <View style={styles.homeHeader}>
          <Pressable
            onPress={() => showNotifications(notifications)}
            style={styles.roundButton}
          >
            <Image source={appAssets.bell} style={styles.bellIcon} />
          </Pressable>
          <BrandTitle size={24} />
          <AvatarButton user={auth.user} onPress={() => navigate('profile')} />
        </View>

        <Text style={styles.kicker}>COLECCIÓN PRIVADA</Text>
        <Text style={styles.heroTitle}>Curaduría de piezas excepcionales</Text>
        <Text style={styles.heroCopy}>Explorá salas activas y programadas con acceso según tu categoría.</Text>

        {loading ? <ActivityIndicator color={colors.gold} /> : null}
        {featured.map((auction) => (
          <AuctionCard
            key={auction.id}
            auction={auction}
            onPress={() => navigate('auctionRoom', { auctionId: auction.id })}
            onToggleWatchlist={() => toggleHomeWatchlist(auction)}
          />
        ))}

        <PrimaryButton label="DESCUBRIR CATÁLOGOS" onPress={() => replace('discover')} style={styles.ctaSpacing} />
      </ScrollView>
    </Screen>
  );
}

function DiscoverScreen({ auth, navigate, goBack, goTab, publicMode = false }) {
  const [auctions, setAuctions] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setAuctions((await (publicMode ? api.publicAuctions() : api.auctions(auth.token))) || []);
    } catch (error) {
      Alert.alert('No pudimos cargar catálogos', error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [auth.token, publicMode]);

  const normalizedQuery = normalize(query);
  const filtered = auctions.filter((auction) => {
    if (!normalizedQuery) {
      return true;
    }
    const searchable = [
      auction.title,
      auction.category,
      auction.preview_lot_title,
      auction.location,
      ...(auction.searchable_terms || []),
    ]
      .join(' ')
      .toLowerCase();
    return normalize(searchable).includes(normalizedQuery);
  });

  async function toggleWatchlist(auction) {
    if (publicMode) {
      return;
    }
    try {
      if (auction.in_watchlist) {
        await api.removeWatchlist(auth.token, auction.id);
      } else {
        await api.addWatchlist(auth.token, auction.id);
      }
      setAuctions((items) =>
        items.map((item) => (item.id === auction.id ? { ...item, in_watchlist: !item.in_watchlist } : item))
      );
    } catch (error) {
      Alert.alert('No pudimos actualizar watchlist', error.message);
    }
  }

  function openAuction(auction) {
    if (auction.can_view_catalog === false) {
      Alert.alert('Catálogo restringido', auction.view_block_reason || 'Tu categoría no permite ver esta sala.');
      return;
    }
    navigate(publicMode ? 'publicAuctionRoom' : 'auctionRoom', { auctionId: auction.id });
  }

  return (
    <Screen footer={publicMode ? null : <FooterNav active="discover" onNavigate={goTab} />}>
      <ScrollView contentContainerStyle={styles.contentWithFooter}>
        <Header
          title="Catálogos"
          onBack={goBack}
          right={publicMode ? null : <AvatarButton user={auth.user} onPress={() => navigate('profile')} />}
        />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar catálogos, categorías o lotes"
          placeholderTextColor={colors.muted}
          style={styles.search}
        />
        {loading ? <ActivityIndicator color={colors.gold} /> : null}
        {filtered.map((auction) => (
          <AuctionCard
            key={auction.id}
            auction={auction}
            onPress={() => openAuction(auction)}
            onToggleWatchlist={publicMode ? null : () => toggleWatchlist(auction)}
          />
        ))}
        {!loading && filtered.length === 0 ? (
          <Text style={styles.emptyText}>No encontramos catálogos para esa búsqueda.</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function AuctionRoomScreen({ auth, auctionId, goBack, goTab, publicMode = false }) {
  const [detail, setDetail] = useState(null);
  const [amount, setAmount] = useState('');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const socketRef = useRef(null);
  const liveJoinAttemptedRef = useRef(false);

  async function load() {
    try {
      const [data, payments] = await (publicMode
        ? Promise.all([api.publicAuctionDetail(auctionId), Promise.resolve([])])
        : Promise.all([api.auctionDetail(auth.token, auctionId), api.paymentMethods(auth.token)]));
      setDetail(data);
      setPaymentMethods(payments || []);
      setSelectedPaymentId((current) => {
        const eligible = eligiblePayments(payments || [], data.currency);
        return eligible.some((payment) => payment.id === current) ? current : eligible[0]?.id || null;
      });
    } catch (error) {
      Alert.alert('No pudimos cargar la sala', error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => {
      clearInterval(interval);
      closeRealtimeSocket(socketRef);
    };
  }, [auth.token, auctionId, publicMode]);

  useEffect(() => {
    if (publicMode || !detail || detail.state !== 'abierta') {
      closeRealtimeSocket(socketRef);
      return;
    }
    if (detail.connected) {
      openRealtimeSocket(socketRef, auth.token, auctionId, setDetail);
      return;
    }
    if (liveJoinAttemptedRef.current) {
      return;
    }
    liveJoinAttemptedRef.current = true;
    api.joinAuction(auth.token, auctionId)
      .then((response) => {
        if (response.connected) {
          setDetail((current) => current ? { ...current, connected: true, can_bid: response.can_bid, block_reason: response.block_reason } : current);
          openRealtimeSocket(socketRef, auth.token, auctionId, setDetail);
        }
      })
      .catch(() => {
        // Users without access can still inspect the catalog without joining the live room.
      });
  }, [auth.token, auctionId, detail?.id, detail?.state, detail?.connected, publicMode]);

  async function joinIfNeeded() {
    if (publicMode) {
      Alert.alert('Inicia sesion', 'Necesitas una cuenta aprobada para conectarte y pujar.');
      return false;
    }
    if (!detail || detail.state !== 'abierta') {
      return true;
    }
    try {
      const response = await api.joinAuction(auth.token, auctionId);
      if (response.connected) {
        setDetail((current) => current ? { ...current, connected: true, can_bid: response.can_bid, block_reason: response.block_reason } : current);
        openRealtimeSocket(socketRef, auth.token, auctionId, setDetail);
      }
      if (!response.can_bid) {
        Alert.alert('No podés pujar', response.block_reason || 'La sala no permite nuevas pujas para tu usuario.');
        return false;
      }
      return true;
    } catch (error) {
      Alert.alert('No pudimos entrar a la sala', error.message);
      return false;
    }
  }

  async function submitBid() {
    const lot = detail?.current_lot;
    const bidAmount = Number(amount.replace(',', '.'));
    if (!lot) {
      Alert.alert('Sin lote activo', 'Esta sala todavía no tiene un lote disponible para pujar.');
      return;
    }
    if (!Number.isFinite(bidAmount)) {
      Alert.alert('Monto inválido', 'Ingresá un monto numérico para pujar.');
      return;
    }
    if (bidAmount < lot.min_bid) {
      Alert.alert('Puja menor al mínimo', `El monto es menor al mínimo admitido: ${money(lot.min_bid, detail.currency)}.`);
      return;
    }
    if (lot.max_bid && bidAmount > lot.max_bid) {
      Alert.alert('Puja mayor al máximo', `El monto es mayor al máximo admitido: ${money(lot.max_bid, detail.currency)}.`);
      return;
    }
    if (lot.can_bid === false) {
      Alert.alert('No podés pujar', lot.block_reason || detail.block_reason || 'La puja está bloqueada para este usuario.');
      return;
    }
    if (!selectedPaymentId) {
      Alert.alert('Medio de pago requerido', `Selecciona un medio de pago verificado en ${detail.currency}.`);
      return;
    }

    setSubmitting(true);
    try {
      const joined = await joinIfNeeded();
      if (!joined) {
        return;
      }
      await api.bid(auth.token, auctionId, lot.id, bidAmount, selectedPaymentId);
      setAmount('');
      await load();
      Alert.alert('Puja confirmada', 'Tu oferta fue registrada correctamente.');
    } catch (error) {
      Alert.alert('No pudimos registrar la puja', error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function leaveAuction() {
    if (publicMode) {
      return;
    }
    try {
      const response = await api.leaveAuction(auth.token, auctionId);
      await load();
      Alert.alert('Saliste de la sala', response.message || 'Ya podés participar en otra subasta.');
    } catch (error) {
      Alert.alert('No pudimos abandonar la sala', error.message);
    }
  }

  if (loading && !detail) {
    return (
      <Screen>
        <ActivityIndicator color={colors.gold} style={styles.centerLoader} />
      </Screen>
    );
  }

  const lots = detail?.lots || [];
  const currentLot = detail?.current_lot;
  const upcoming = detail?.state === 'programada';

  return (
    <Screen footer={publicMode ? null : <FooterNav active="discover" onNavigate={goTab} />}>
      <ScrollView contentContainerStyle={styles.contentWithFooter}>
        <Header title="Sala" onBack={goBack} right={<Text style={styles.smallGold}>{categoryLabel(detail?.category)}</Text>} />

        <View style={styles.roomHero}>
          <View style={styles.roomHeroTop}>
            <Text style={styles.categoryTextLarge}>{categoryLabel(detail?.category)}</Text>
            {!publicMode && detail?.connected ? <GhostButton label="ABANDONAR SALA" onPress={leaveAuction} style={styles.leaveButton} /> : null}
          </View>
          <Text style={styles.roomTitle}>{detail?.title}</Text>
          <Text style={styles.roomMeta}>{detail?.location} · {detail?.auctioneer_name}</Text>
          <Text style={styles.roomCopy}>
            {upcoming
              ? 'Esta subasta esta programada. Podes ver el catalogo y su precio base; las pujas se habilitan cuando abra la sala.'
              : 'La sala muestra un lote a la vez. Cuando se adjudica el lote en exhibición, avanza al siguiente.'}
          </Text>
        </View>

        {currentLot ? (
          <>
            <Text style={styles.sectionTitle}>Lote en sala</Text>
            <LotCard lot={currentLot} currency={detail.currency} active />
            {!publicMode ? <View style={styles.bidPanel}>
              <Text style={styles.mutedText}>Tiempo restante: {currentLot.bid_seconds_remaining ?? 60}s</Text>
              <Text style={styles.mutedText}>Mínimo: {money(currentLot.min_bid, detail.currency)}</Text>
              {currentLot.max_bid ? <Text style={styles.mutedText}>Máximo: {money(currentLot.max_bid, detail.currency)}</Text> : null}
              <BidHistory history={currentLot.bid_history || []} currency={detail.currency} />
              <PaymentPicker
                currency={detail.currency}
                payments={paymentMethods}
                selectedId={selectedPaymentId}
                onSelect={setSelectedPaymentId}
              />
              <Field label="MONTO A PUJAR" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Ingresá tu oferta" />
              <PrimaryButton
                label={submitting ? 'REGISTRANDO...' : upcoming ? 'PUJA NO DISPONIBLE' : 'PUJAR AHORA'}
                onPress={submitBid}
                disabled={submitting || upcoming}
              />
            </View> : null}
          </>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Lotes del catálogo</Text>
          <Text style={styles.smallGold}>{lots.length} PIEZAS</Text>
        </View>
        {lots.map((lot) => (
          <LotCard key={lot.id} lot={lot} currency={detail.currency} active={lot.id === currentLot?.id} />
        ))}
      </ScrollView>
    </Screen>
  );
}

function BidHistory({ history, currency }) {
  const rows = (history || []).slice(-5);
  if (!rows.length) {
    return <Text style={styles.mutedText}>Todavia no hay ofertas para este lote.</Text>;
  }
  return (
    <View style={styles.bidHistory}>
      <Text style={styles.bidHistoryTitle}>OFERTAS VISIBLES</Text>
      {rows.map((bid, index) => (
        <View key={`${bid.created_at || index}-${bid.amount}`} style={styles.bidHistoryRow}>
          <Text style={styles.mutedText}>{bid.is_mine ? 'Vos' : `Postor ${index + 1}`}</Text>
          <Text style={styles.bidHistoryAmount}>{money(bid.amount, currency)}</Text>
        </View>
      ))}
    </View>
  );
}

function PaymentPicker({ currency, payments, selectedId, onSelect }) {
  const eligible = eligiblePayments(payments, currency);
  if (!eligible.length) {
    return <Text style={styles.mutedText}>Necesitas un medio de pago verificado en {currency}.</Text>;
  }
  return (
    <View style={styles.paymentPicker}>
      <Text style={styles.bidHistoryTitle}>MEDIO DE PAGO</Text>
      {eligible.map((payment) => {
        const selected = payment.id === selectedId;
        return (
          <Pressable
            key={payment.id}
            onPress={() => onSelect(payment.id)}
            style={[styles.paymentChoice, selected && styles.paymentChoiceActive]}
          >
            <Text style={[styles.paymentChoiceText, selected && styles.paymentChoiceTextActive]}>
              {payment.display_name} · {money(payment.available_amount, payment.currency)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function eligiblePayments(payments, currency) {
  return (payments || []).filter(
    (payment) =>
      String(payment.status || '').toLowerCase() === 'verificado' &&
      String(payment.currency || '').toUpperCase() === String(currency || '').toUpperCase()
  );
}

function openRealtimeSocket(socketRef, token, auctionId, setDetail) {
  if (socketRef.current || !token) {
    return;
  }
  const wsBase = SERVER_BASE_URL.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
  const socket = new WebSocket(`${wsBase}/ws/subastas/${auctionId}?token=${encodeURIComponent(token)}`);
  socketRef.current = socket;
  socket.onmessage = (event) => {
    let payload = null;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }
    if (payload?.type === 'bid.updated') {
      setDetail((current) => applyBidUpdate(current, payload));
    }
  };
  socket.onclose = () => {
    if (socketRef.current === socket) {
      socketRef.current = null;
    }
  };
  socket.onerror = () => {
    if (socketRef.current === socket) {
      socketRef.current = null;
    }
  };
}

function closeRealtimeSocket(socketRef) {
  if (socketRef.current) {
    socketRef.current.close();
    socketRef.current = null;
  }
}

function applyBidUpdate(detail, update) {
  if (!detail) {
    return detail;
  }
  const patchLot = (lot) => {
    if (!lot || lot.id !== update.lot_id) {
      return lot;
    }
    return {
      ...lot,
      current_bid: update.amount,
      current_bidder_id: update.user_id,
      min_bid: update.min_bid,
      max_bid: update.max_bid,
      bid_history: update.bid_history || lot.bid_history,
      bid_deadline_at: update.bid_deadline_at || lot.bid_deadline_at,
      bid_seconds_remaining: update.bid_seconds_remaining ?? lot.bid_seconds_remaining,
    };
  };
  const lots = (detail.lots || []).map(patchLot);
  return {
    ...detail,
    current_lot: patchLot(detail.current_lot),
    lots,
    upcoming_lots: (detail.upcoming_lots || []).map(patchLot),
    completed_lots: (detail.completed_lots || []).map(patchLot),
    best_offer: detail.current_lot?.id === update.lot_id ? update.amount : detail.best_offer,
  };
}

function WatchlistScreen({ auth, navigate, goTab }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setItems((await api.watchlist(auth.token)) || []);
    } catch (error) {
      Alert.alert('No pudimos cargar watchlist', error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [auth.token]);

  async function remove(auction) {
    try {
      await api.removeWatchlist(auth.token, auction.id);
      setItems((current) => current.filter((item) => item.id !== auction.id));
    } catch (error) {
      Alert.alert('No pudimos quitar la sala', error.message);
    }
  }

  return (
    <Screen footer={<FooterNav active="watchlist" onNavigate={goTab} />}>
      <ScrollView contentContainerStyle={styles.contentWithFooter}>
        <Header
          title="Watchlist"
          right={<AvatarButton user={auth.user} onPress={() => navigate('profile')} />}
        />
        {loading ? <ActivityIndicator color={colors.gold} /> : null}
        {items.map((auction) => (
          <AuctionCard
            key={auction.id}
            auction={{ ...auction, in_watchlist: true }}
            onPress={() => navigate('auctionRoom', { auctionId: auction.id })}
            onToggleWatchlist={() => remove(auction)}
          />
        ))}
        {!loading && items.length === 0 ? (
          <Text style={styles.emptyText}>Todavía no guardaste subastas programadas.</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function BidsScreen({ auth, navigate, goTab }) {
  const [activeAuction, setActiveAuction] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setActiveAuction(await api.activeAuction(auth.token));
    } catch (error) {
      Alert.alert('No pudimos cargar tus pujas', error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [auth.token]);

  async function leave() {
    if (!activeAuction) {
      return;
    }
    try {
      await api.leaveAuction(auth.token, activeAuction.auction_id);
      setActiveAuction(null);
      Alert.alert('Sala abandonada', 'Tu última puja fue retirada según las reglas de la sala.');
    } catch (error) {
      Alert.alert('No pudimos abandonar la sala', error.message);
    }
  }

  return (
    <Screen footer={<FooterNav active="bids" onNavigate={goTab} />}>
      <ScrollView contentContainerStyle={styles.contentWithFooter}>
        <Header title="Pujas" />
        {loading ? <ActivityIndicator color={colors.gold} /> : null}
        {!loading && !activeAuction ? (
          <Text style={styles.emptyText}>No estás participando activamente en ninguna subasta.</Text>
        ) : null}
        {activeAuction ? (
          <View style={styles.panel}>
            <Text style={styles.kicker}>{categoryLabel(activeAuction.category)}</Text>
            <Text style={styles.panelTitle}>{activeAuction.title}</Text>
            <Text style={styles.mutedText}>Lote actual: {activeAuction.current_lot_title || 'Sin lote activo'}</Text>
            <Text style={styles.priceText}>{money(activeAuction.current_price, activeAuction.currency)}</Text>
            <PrimaryButton label="VOLVER A LA SALA" onPress={() => navigate('auctionRoom', { auctionId: activeAuction.auction_id })} />
            <GhostButton label="ABANDONAR SALA" onPress={leave} style={styles.topSpace} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function ConsignmentScreen({ auth, goBack }) {
  const [items, setItems] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [proposalPayouts, setProposalPayouts] = useState({});
  const [form, setForm] = useState(defaultConsignmentForm());

  async function load() {
    setLoading(true);
    try {
      setItems((await api.consignments(auth.token)) || []);
    } catch (error) {
      Alert.alert('No pudimos cargar tus piezas', error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [auth.token]);

  async function pickPhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Acceso a galeria denegado', 'Necesitamos acceso a tu galeria para cargar al menos seis fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.72,
      base64: true,
    });
    if (result.canceled) {
      return;
    }
    const selected = (result.assets || []).map((asset, index) => ({
      id: `${asset.uri}-${index}`,
      name: asset.fileName || `foto-${index + 1}.jpg`,
      uri: asset.uri,
      dataUrl: imageAssetToDataUrl(asset),
    }));
    setPhotos(selected);
  }

  function fillDemoConsignment() {
    const ownerName = auth.user?.first_name || 'Admin';
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 12);
    setForm({
      title: `Juego de te de plata ${stamp}`,
      description: 'Juego de te de 18 piezas con bandeja, tetera, azucarera, lechera y tazas. Estado general muy bueno.',
      story: 'Pieza familiar adquirida en comercio registrado. Se entrega con antecedentes de compra y fotos de detalle.',
      item_count: '18',
      collection_name: `Coleccion ${ownerName}`,
      payout_account: 'Cuenta a la vista ARS - Alias ATELIER.ADMIN',
      lawful_origin_evidence: 'Factura de compra\nDeclaracion jurada de titularidad\nFotos historicas del bien',
      declared_ownership: true,
      declared_legal_origin: true,
      declared_return_charge_agreement: true,
    });
    setPhotos(
      Array.from({ length: 6 }, (_, index) => {
        const number = index + 1;
        return {
          id: `demo-consignment-${stamp}-${number}`,
          name: `foto-demo-${number}.jpg`,
          uri: `https://placehold.co/1200x900/3b3428/f2d58d?text=Consignacion+${number}`,
          dataUrl: `https://placehold.co/1200x900/3b3428/f2d58d?text=Consignacion+${number}`,
        };
      })
    );
  }

  async function submit() {
    const itemCount = Number(form.item_count || '1');
    const evidence = form.lawful_origin_evidence
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (!form.title.trim() || !form.description.trim()) {
      Alert.alert('Datos requeridos', 'Completa titulo y descripcion del bien.');
      return;
    }
    if (photos.length < 6) {
      Alert.alert('Fotos insuficientes', 'Debes cargar al menos 6 fotos del bien.');
      return;
    }
    if (!Number.isFinite(itemCount) || itemCount < 1) {
      Alert.alert('Cantidad invalida', 'La cantidad de articulos debe ser al menos 1.');
      return;
    }
    if (!form.declared_ownership || !form.declared_legal_origin || !form.declared_return_charge_agreement) {
      Alert.alert('Declaraciones requeridas', 'Debes declarar titularidad, origen licito y devolucion con cargo.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      story: form.story.trim() || null,
      photos: photos.map((photo) => photo.dataUrl),
      declared_ownership: form.declared_ownership,
      declared_legal_origin: form.declared_legal_origin,
      declared_return_charge_agreement: form.declared_return_charge_agreement,
      lawful_origin_evidence: evidence,
      item_count: itemCount,
      collection_name: form.collection_name.trim() || null,
      payout_account: form.payout_account.trim() || null,
    };

    setSubmitting(true);
    try {
      await api.createConsignment(auth.token, payload);
      setForm(defaultConsignmentForm());
      setPhotos([]);
      await load();
      Alert.alert('Pieza enviada', 'La empresa revisara el bien y te informara los proximos pasos por la app.');
    } catch (error) {
      Alert.alert('No pudimos enviar la pieza', error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function decide(item, accept) {
    const payout = (proposalPayouts[item.id] || item.payout_account || '').trim();
    if (accept && !payout) {
      Alert.alert('Cuenta requerida', 'Declara una cuenta de liquidacion antes de aceptar la propuesta.');
      return;
    }
    try {
      await api.decideConsignmentProposal(auth.token, item.id, accept, payout || null);
      await load();
      Alert.alert(accept ? 'Propuesta aceptada' : 'Propuesta rechazada', accept ? 'La pieza quedo lista para incluirse en subasta.' : 'La empresa coordinara la devolucion con gastos informados.');
    } catch (error) {
      Alert.alert('No pudimos responder la propuesta', error.message);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.contentWithFooter}>
        <Header title="Consignar" onBack={goBack} />
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Poner pieza en subasta</Text>
          <Field label="TITULO" value={form.title} onChangeText={(value) => setForm({ ...form, title: value })} />
          <Field label="DESCRIPCION" value={form.description} onChangeText={(value) => setForm({ ...form, description: value })} multiline numberOfLines={4} />
          <Field label="HISTORIA / PROCEDENCIA" value={form.story} onChangeText={(value) => setForm({ ...form, story: value })} multiline numberOfLines={4} />
          <Field label="CANTIDAD DE ARTICULOS" value={form.item_count} onChangeText={(value) => setForm({ ...form, item_count: digits(value) || '1' })} keyboardType="numeric" />
          <Field label="COLECCION" value={form.collection_name} onChangeText={(value) => setForm({ ...form, collection_name: value })} placeholder="Opcional para varias piezas" />
          <Field label="CUENTA DE LIQUIDACION" value={form.payout_account} onChangeText={(value) => setForm({ ...form, payout_account: value })} placeholder="CBU, alias, IBAN o cuenta a la vista" />
          <Field label="EVIDENCIA DE ORIGEN LICITO" value={form.lawful_origin_evidence} onChangeText={(value) => setForm({ ...form, lawful_origin_evidence: value })} placeholder="Facturas, certificados, links o notas" multiline numberOfLines={3} />
          <View style={styles.formActionStack}>
            <GhostButton label="GENERAR DATOS DE PRUEBA" onPress={fillDemoConsignment} />
            <GhostButton label={photos.length >= 6 ? `${photos.length} FOTOS CARGADAS` : `CARGAR FOTOS (${photos.length}/6)`} onPress={pickPhotos} />
          </View>
          <Text style={styles.formHelper}>{photos.length ? photos.map((photo) => photo.name).join('\n') : 'Todavia no cargaste fotos del bien.'}</Text>
          <CheckRow label="Declaro que el bien me pertenece y no tiene impedimentos." value={form.declared_ownership} onChange={(value) => setForm({ ...form, declared_ownership: value })} />
          <CheckRow label="Declaro que el bien tiene origen licito." value={form.declared_legal_origin} onChange={(value) => setForm({ ...form, declared_legal_origin: value })} />
          <CheckRow label="Acepto devolucion con cargo si la empresa no acepta el bien enviado." value={form.declared_return_charge_agreement} onChange={(value) => setForm({ ...form, declared_return_charge_agreement: value })} />
          <PrimaryButton label={submitting ? 'ENVIANDO...' : 'ENVIAR A EVALUACION'} onPress={submit} disabled={submitting} style={styles.topSpace} />
        </View>

        <Text style={styles.sectionTitle}>Tus consignaciones</Text>
        {loading ? <ActivityIndicator color={colors.gold} /> : null}
        {!loading && items.length === 0 ? <Text style={styles.emptyText}>Todavia no enviaste piezas para evaluacion.</Text> : null}
        {items.map((item) => (
          <ConsignmentCard
            key={item.id}
            item={item}
            payoutValue={proposalPayouts[item.id] || item.payout_account || ''}
            onPayoutChange={(value) => setProposalPayouts((current) => ({ ...current, [item.id]: value }))}
            onAccept={() => decide(item, true)}
            onReject={() => decide(item, false)}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

function ConsignmentCard({ item, payoutValue, onPayoutChange, onAccept, onReject }) {
  const pending = item.status === 'pendiente_confirmacion';
  return (
    <View style={styles.consignmentCard}>
      <Text style={styles.smallGold}>{consignmentStatusLabel(item.status)}</Text>
      <Text style={styles.paymentName}>{item.title}</Text>
      <Text style={styles.mutedText}>{item.description}</Text>
      <Text style={styles.mutedText}>{consignmentMeta(item)}</Text>
      {item.insurance_policy ? (
        <View style={styles.insurancePanel}>
          <Text style={styles.bidHistoryTitle}>POLIZA / DEPOSITO</Text>
          <Text style={styles.mutedText}>Poliza: {item.insurance_policy}</Text>
          <Text style={styles.mutedText}>Deposito: {item.storage_location || 'No informado'}</Text>
          <Text style={styles.mutedText}>Podes contactar a la aseguradora indicada en la poliza para aumentar el valor asegurado pagando la diferencia del premio.</Text>
        </View>
      ) : null}
      {pending ? (
        <View style={styles.topSpace}>
          <Field label="CUENTA PARA LIQUIDACION" value={payoutValue} onChangeText={onPayoutChange} placeholder="CBU, alias, IBAN o cuenta exterior" />
          <PrimaryButton label="ACEPTAR BASE Y COMISION" onPress={onAccept} />
          <GhostButton label="NO ACEPTAR PROPUESTA" onPress={onReject} style={styles.compactTopSpace} />
        </View>
      ) : null}
    </View>
  );
}

function CheckRow({ label, value, onChange }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.checkRow}>
      <Text style={[styles.checkBox, value && styles.checkBoxActive]}>{value ? 'X' : ''}</Text>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

function ProfileScreen({ auth, setAuth, navigate, goBack, goTab }) {
  const [profile, setProfile] = useState(auth.user);
  const [payments, setPayments] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    first_name: auth.user?.first_name || '',
    last_name: auth.user?.last_name || '',
    email: auth.user?.email || '',
    legal_address: auth.user?.legal_address || '',
  });
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState(defaultPaymentForm());

  async function load() {
    try {
      const [profileData, paymentData, metricsData] = await Promise.all([
        api.profile(auth.token),
        api.paymentMethods(auth.token).catch(() => []),
        api.metrics(auth.token).catch(() => null),
      ]);
      setProfile(profileData);
      setAuth((current) => ({ ...current, user: profileData }));
      setPayments(paymentData || []);
      setMetrics(metricsData);
      setForm({
        first_name: profileData.first_name || '',
        last_name: profileData.last_name || '',
        email: profileData.email || '',
        legal_address: profileData.legal_address || '',
      });
    } catch (error) {
      Alert.alert('No pudimos cargar perfil', error.message);
    }
  }

  useEffect(() => {
    load();
  }, [auth.token]);

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Acceso a galería denegado', 'Necesitamos acceso a tu galería para cambiar la foto de perfil.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
    });
    if (result.canceled || !result.assets?.[0]?.uri) {
      return;
    }
    try {
      const updated = await api.updateAvatar(auth.token, result.assets[0].uri);
      setProfile(updated);
      setAuth((current) => ({ ...current, user: updated }));
    } catch (error) {
      Alert.alert('No pudimos cambiar la foto', error.message);
    }
  }

  async function saveProfile() {
    if (!form.email.includes('@')) {
      Alert.alert('Mail inválido', 'El correo electrónico debe contener @.');
      return;
    }
    try {
      const updated = await api.updateProfile(auth.token, form);
      setProfile(updated);
      setAuth((current) => ({ ...current, user: updated }));
      setEditing(false);
      Alert.alert('Perfil actualizado', 'Tus datos personales fueron guardados.');
    } catch (error) {
      Alert.alert('No pudimos guardar perfil', error.message);
    }
  }

  async function deletePayment(payment) {
    try {
      await api.deletePaymentMethod(auth.token, payment.id);
      setPayments((current) => current.filter((item) => item.id !== payment.id));
    } catch (error) {
      Alert.alert('No pudimos eliminar el medio de pago', error.message);
    }
  }

  async function createPayment() {
    const amount = Number(paymentForm.available_amount);
    const issuerCountry = paymentForm.issuer_country.trim().toUpperCase();
    if (!paymentForm.holder_first_name || !paymentForm.holder_last_name) {
      Alert.alert('Datos obligatorios', 'Completá nombre y apellido del titular.');
      return;
    }
    if (!issuerCountry) {
      Alert.alert('Pais emisor obligatorio', 'Indica el pais emisor del medio de pago.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Monto inválido', 'El monto disponible debe ser numérico.');
      return;
    }
    if (paymentForm.type === 'tarjeta_credito' && paymentForm.card_number.length !== 16) {
      Alert.alert('Número de tarjeta inválido', 'El número de tarjeta debe tener exactamente 16 dígitos.');
      return;
    }

    if (paymentForm.type === 'tarjeta_credito' && !paymentForm.expiration_date) {
      Alert.alert('Vencimiento obligatorio', 'Ingresa el vencimiento de la tarjeta.');
      return;
    }

    const payload = {
      type: paymentForm.type,
      display_name: paymentDisplayName(paymentForm),
      currency: paymentForm.currency,
      issuer_country: issuerCountry,
      available_amount: amount,
      holder_first_name: paymentForm.holder_first_name,
      holder_last_name: paymentForm.holder_last_name,
      issuing_bank: paymentForm.issuing_bank,
      last_four: paymentForm.card_number ? paymentForm.card_number.slice(-4) : null,
      expiration_date: paymentForm.expiration_date || null,
    };

    try {
      const created = await api.createPaymentMethod(auth.token, payload);
      setPayments((current) => [...current, created]);
      setPaymentForm(defaultPaymentForm());
      setShowPaymentForm(false);
      Alert.alert('Medio de pago agregado', 'Quedó pendiente de verificación administrativa.');
    } catch (error) {
      Alert.alert('No pudimos agregar el medio de pago', error.message);
    }
  }

  const avatar = imageSource(profile?.avatar_image_url);

  return (
    <Screen footer={<FooterNav active="bids" onNavigate={goTab} />}>
      <ScrollView contentContainerStyle={styles.contentWithFooter}>
        <Header title="Perfil" onBack={goBack} right={<Pressable onPress={pickAvatar}><Image source={appAssets.camera} style={styles.headerCamera} /></Pressable>} />

        <View style={styles.profileHero}>
          <Pressable onPress={pickAvatar} style={styles.profileAvatarWrap}>
            {avatar ? <Image source={avatar} style={styles.profileAvatar} /> : <Text style={styles.profileInitial}>A</Text>}
            <View style={styles.profileCameraBadge}>
              <Image source={appAssets.camera} style={styles.profileCameraIcon} />
            </View>
          </Pressable>
          <Text style={styles.profileName}>{profile?.full_name || `${profile?.first_name || ''} ${profile?.last_name || ''}`}</Text>
          <Text style={styles.profileCategory}>{categoryLabel(profile?.category)}</Text>
        </View>

        {metrics ? <MetricsPanel metrics={metrics} /> : null}

        <GhostButton label="PONER PIEZA EN SUBASTA" onPress={() => navigate('consignments')} style={styles.topSpace} />

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Información personal</Text>
          <Pressable onPress={() => setEditing((value) => !value)} style={styles.inlineActionButton}>
            <Text style={styles.inlineActionText}>{editing ? 'CANCELAR' : 'EDITAR'}</Text>
          </Pressable>
        </View>

        <Field label="NOMBRE" value={form.first_name} onChangeText={(value) => setForm({ ...form, first_name: value })} editable={editing} />
        <Field label="APELLIDO" value={form.last_name} onChangeText={(value) => setForm({ ...form, last_name: value })} editable={editing} />
        <Field label="MAIL" value={form.email} onChangeText={(value) => setForm({ ...form, email: value })} editable={editing} />
        <Field label="DIRECCIÓN LEGAL" value={form.legal_address} onChangeText={(value) => setForm({ ...form, legal_address: value })} editable={editing} />
        {editing ? <PrimaryButton label="GUARDAR CAMBIOS" onPress={saveProfile} /> : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Medios de pago</Text>
          <Pressable onPress={() => setShowPaymentForm((value) => !value)} style={styles.inlineActionButton}>
            <Text style={styles.inlineActionText}>{showPaymentForm ? 'CERRAR' : 'AGREGAR'}</Text>
          </Pressable>
        </View>

        {payments.map((payment) => (
          <View key={payment.id} style={styles.paymentRow}>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentName}>{payment.display_name}</Text>
              <Text style={styles.mutedText}>
                {payment.currency} · {payment.issuer_country || '--'} · {payment.status} · {money(payment.available_amount, payment.currency)}
              </Text>
            </View>
            <Pressable onPress={() => deletePayment(payment)} style={styles.dangerButton}>
              <Text style={styles.dangerButtonText}>ELIMINAR</Text>
            </Pressable>
          </View>
        ))}

        {showPaymentForm ? (
          <View style={styles.panel}>
            <PaymentTypeSelector value={paymentForm.type} onChange={(type) => setPaymentForm({ ...paymentForm, type })} />
            <Field label="NOMBRE TITULAR" value={paymentForm.holder_first_name} onChangeText={(value) => setPaymentForm({ ...paymentForm, holder_first_name: value })} />
            <Field label="APELLIDO TITULAR" value={paymentForm.holder_last_name} onChangeText={(value) => setPaymentForm({ ...paymentForm, holder_last_name: value })} />
            <Field label="MONEDA" value={paymentForm.currency} onChangeText={(value) => setPaymentForm({ ...paymentForm, currency: value.toUpperCase() })} />
            <Field label="PAIS EMISOR" value={paymentForm.issuer_country} onChangeText={(value) => setPaymentForm({ ...paymentForm, issuer_country: value.toUpperCase().slice(0, 2) })} />
            <Field label="BANCO EMISOR" value={paymentForm.issuing_bank} onChangeText={(value) => setPaymentForm({ ...paymentForm, issuing_bank: value })} />
            {paymentForm.type === 'tarjeta_credito' ? (
              <>
                <Field label="NÚMERO DE TARJETA" value={paymentForm.card_number} onChangeText={(value) => setPaymentForm({ ...paymentForm, card_number: digits(value).slice(0, 16) })} keyboardType="numeric" />
                <Field label="VENCIMIENTO" value={paymentForm.expiration_date} onChangeText={(value) => setPaymentForm({ ...paymentForm, expiration_date: value })} placeholder="AAAA-MM-DD" />
              </>
            ) : null}
            <Field label="MONTO DISPONIBLE" value={paymentForm.available_amount} onChangeText={(value) => setPaymentForm({ ...paymentForm, available_amount: digits(value) })} keyboardType="numeric" />
            <PrimaryButton label="AGREGAR MEDIO DE PAGO" onPress={createPayment} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function PaymentTypeSelector({ value, onChange }) {
  const options = [
    ['tarjeta_credito', 'Tarjeta'],
    ['cuenta_bancaria', 'Cuenta'],
    ['cheque_certificado', 'Cheque'],
  ];
  return (
    <View style={styles.segment}>
      {options.map(([key, label]) => (
        <Pressable key={key} onPress={() => onChange(key)} style={[styles.segmentItem, value === key && styles.segmentItemActive]}>
          <Text style={[styles.segmentText, value === key && styles.segmentTextActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function MetricsPanel({ metrics }) {
  const categories = Object.entries(metrics.categories_joined || {})
    .map(([category, count]) => `${categoryLabel(category)} ${count}`)
    .join(' · ');
  return (
    <View style={styles.metricsPanel}>
      <Text style={styles.bidHistoryTitle}>METRICAS DE SUBASTAS</Text>
      <View style={styles.metricsGrid}>
        <MetricBox label="ASISTIDAS" value={metrics.auctions_joined} />
        <MetricBox label="GANADAS" value={metrics.auctions_won} />
        <MetricBox label="PUJAS ACTIVAS" value={metrics.active_bids} />
      </View>
      <Text style={styles.mutedText}>Ofertado: {money(metrics.total_amount_bid, 'USD')}</Text>
      <Text style={styles.mutedText}>Pagado/adjudicado: {money(metrics.total_amount_paid, 'USD')}</Text>
      {categories ? <Text style={styles.mutedText}>Categorias: {categories}</Text> : null}
    </View>
  );
}

function MetricBox({ label, value }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricValue}>{value ?? 0}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Screen({ children, footer }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.screenInner}>{children}</View>
      {footer}
    </SafeAreaView>
  );
}

function showNotifications(notifications) {
  if (!notifications.length) {
    Alert.alert('Notificaciones', 'No tenés notificaciones nuevas.');
    return;
  }
  Alert.alert(
    'Notificaciones',
    notifications
      .slice(0, 5)
      .map((item) => `${item.title}: ${item.message}`)
      .join('\n\n')
  );
}

function passwordSetupParams(url) {
  const value = String(url || '');
  if (!value.startsWith('atelier://set-password')) {
    return null;
  }
  const query = value.split('?')[1] || '';
  const params = {};
  query.split('&').forEach((part) => {
    const [rawKey, rawValue = ''] = part.split('=');
    if (rawKey) {
      params[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    }
  });
  if (!params.token || !params.email) {
    return null;
  }
  return { token: params.token, email: params.email };
}

function imageAssetToDataUrl(asset) {
  if (!asset?.base64) {
    return asset?.uri || '';
  }
  const mimeType = asset.mimeType || 'image/jpeg';
  return `data:${mimeType};base64,${asset.base64}`;
}

function isAdultBirthDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())) {
    return false;
  }
  const birthDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) {
    return false;
  }
  const minimum = new Date();
  minimum.setFullYear(minimum.getFullYear() - 18);
  return birthDate <= minimum;
}

function isStrongPassword(value) {
  return (
    String(value || '').length >= 6 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

function encodeCountryCode(value) {
  return String(value || 'AR')
    .trim()
    .toUpperCase()
    .slice(0, 2)
    .split('')
    .reduce((accumulator, character) => (accumulator * 100) + character.charCodeAt(0), 0);
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function defaultPaymentForm() {
  return {
    type: 'tarjeta_credito',
    holder_first_name: '',
    holder_last_name: '',
    currency: 'USD',
    issuer_country: 'AR',
    issuing_bank: 'Galicia',
    card_number: '',
    expiration_date: '',
    available_amount: '',
  };
}

function defaultConsignmentForm() {
  return {
    title: '',
    description: '',
    story: '',
    item_count: '1',
    collection_name: '',
    payout_account: '',
    lawful_origin_evidence: '',
    declared_ownership: false,
    declared_legal_origin: false,
    declared_return_charge_agreement: false,
  };
}

function consignmentStatusLabel(status) {
  const labels = {
    enviada: 'ENVIADA',
    en_revision: 'EN REVISION',
    pendiente_confirmacion: 'PROPUESTA',
    aceptada: 'ACEPTADA',
    rechazada: 'RECHAZADA',
    devuelta: 'DEVUELTA',
  };
  return labels[status] || String(status || '').toUpperCase();
}

function consignmentMeta(item) {
  const parts = [`${item.photos?.length || 0} fotos`];
  if (item.item_count > 1) {
    parts.push(`${item.item_count} articulos`);
  }
  if (item.collection_name) {
    parts.push(`Coleccion ${item.collection_name}`);
  }
  if (item.inspection_address) {
    parts.push(`Enviar a inspeccion: ${item.inspection_address}`);
  }
  if (item.assigned_auction_title) {
    parts.push(`Subasta: ${item.assigned_auction_title} - ${item.assigned_auction_scheduled_at || 'fecha a confirmar'} - ${item.assigned_auction_location || 'lugar a confirmar'}`);
  }
  if (item.proposed_base_price) {
    parts.push(`Base ${money(item.proposed_base_price, 'USD')}`);
  }
  if (item.commission_rate !== null && item.commission_rate !== undefined) {
    parts.push(`Comision ${item.commission_rate}`);
  }
  if (item.return_shipping_cost) {
    parts.push(`Devolucion ${money(item.return_shipping_cost, 'USD')}`);
  }
  if (item.return_shipping_note) {
    parts.push(item.return_shipping_note);
  }
  if (item.rejection_reason) {
    parts.push(item.rejection_reason);
  }
  if (item.origin_doubt_reported) {
    parts.push('Duda de origen informada a autoridades');
  }
  if (item.origin_doubt_notes) {
    parts.push(`Origen: ${item.origin_doubt_notes}`);
  }
  return parts.join('  |  ');
}

function paymentDisplayName(form) {
  if (form.type === 'tarjeta_credito') {
    return `Tarjeta terminada en ${form.card_number.slice(-4)}`;
  }
  if (form.type === 'cuenta_bancaria') {
    return `Cuenta ${form.issuing_bank}`;
  }
  return `Cheque ${form.currency}`;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  screen: {
    backgroundColor: colors.black,
    flex: 1,
  },
  screenInner: {
    flex: 1,
  },
  splashShade: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 110,
  },
  enterGallery: {
    color: colors.goldSoft,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 3,
  },
  loginContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.screen,
  },
  loginTitle: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: 38,
    fontWeight: '800',
    marginTop: 38,
    textAlign: 'center',
  },
  loginCopy: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 25,
    marginBottom: 26,
    marginTop: 12,
    textAlign: 'center',
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 18,
    padding: 20,
  },
  apiHint: {
    color: colors.goldDark,
    fontSize: 11,
    marginTop: 14,
    textAlign: 'center',
  },
  contentWithFooter: {
    padding: 18,
    paddingBottom: 124,
    paddingTop: 16,
  },
  homeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  roundButton: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  bellIcon: {
    height: 24,
    resizeMode: 'contain',
    tintColor: colors.gold,
    width: 24,
  },
  kicker: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: 8,
  },
  heroTitle: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: 42,
    fontWeight: '800',
    lineHeight: 48,
  },
  heroCopy: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 26,
    marginBottom: 26,
    marginTop: 12,
  },
  ctaSpacing: {
    marginTop: 8,
  },
  search: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    marginBottom: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 26,
    marginTop: 24,
    textAlign: 'center',
  },
  centerLoader: {
    flex: 1,
  },
  smallGold: {
    alignSelf: 'flex-start',
    backgroundColor: colors.panelSoft,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    lineHeight: 15,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roomHero: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 30,
    borderWidth: 1,
    marginBottom: 26,
    padding: 22,
  },
  roomHeroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  categoryTextLarge: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 5,
  },
  leaveButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  roomTitle: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: 33,
    fontWeight: '800',
    lineHeight: 39,
  },
  roomMeta: {
    color: colors.muted,
    fontSize: 15,
    marginTop: 14,
  },
  roomCopy: {
    color: colors.paper,
    fontSize: 16,
    lineHeight: 25,
    marginTop: 18,
  },
  sectionTitle: {
    color: colors.text,
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 31,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: 30,
  },
  bidPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 26,
    padding: 18,
  },
  topSpace: {
    marginTop: 14,
  },
  compactTopSpace: {
    marginTop: 10,
  },
  bidHistory: {
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    marginTop: 12,
    padding: 12,
  },
  bidHistoryTitle: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  bidHistoryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bidHistoryAmount: {
    color: colors.goldSoft,
    fontSize: 15,
    fontWeight: '900',
  },
  paymentPicker: {
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    marginTop: 12,
    padding: 12,
  },
  paymentChoice: {
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  paymentChoiceActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  paymentChoiceText: {
    color: colors.paper,
    fontSize: 13,
    fontWeight: '800',
  },
  paymentChoiceTextActive: {
    color: colors.mustardLight,
  },
  panelTitle: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 33,
    marginBottom: 18,
  },
  profileHero: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileAvatarWrap: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.gold,
    borderRadius: 76,
    borderWidth: 2,
    height: 128,
    justifyContent: 'center',
    marginBottom: 16,
    width: 128,
  },
  profileAvatar: {
    borderRadius: 61,
    height: 118,
    width: 118,
  },
  profileInitial: {
    color: colors.gold,
    fontSize: 40,
    fontWeight: '900',
  },
  profileCameraBadge: {
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderColor: colors.black,
    borderRadius: 24,
    borderWidth: 2,
    bottom: 2,
    height: 48,
    justifyContent: 'center',
    position: 'absolute',
    right: 2,
    width: 48,
  },
  profileCameraIcon: {
    height: 23,
    tintColor: colors.mustardLight,
    width: 23,
  },
  headerCamera: {
    height: 24,
    tintColor: colors.gold,
    width: 24,
  },
  profileName: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  profileCategory: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: 8,
  },
  metricsPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    marginBottom: 18,
    padding: 18,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricBox: {
    backgroundColor: colors.black,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    minWidth: 92,
    padding: 12,
  },
  metricValue: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: '900',
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 14,
    marginTop: 4,
  },
  inlineActionButton: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.goldDark,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  inlineActionText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 3,
  },
  paymentRow: {
    alignItems: 'stretch',
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    marginBottom: 12,
    padding: 18,
  },
  paymentInfo: {
    gap: 6,
  },
  consignmentCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
    padding: 18,
  },
  insurancePanel: {
    backgroundColor: colors.black,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  formActionStack: {
    gap: 10,
    marginTop: 2,
  },
  formHelper: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
  },
  checkRow: {
    alignItems: 'flex-start',
    backgroundColor: colors.black,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    minHeight: 56,
    padding: 12,
  },
  checkBox: {
    borderColor: colors.gold,
    borderRadius: 6,
    borderWidth: 1,
    color: colors.mustardLight,
    fontSize: 12,
    fontWeight: '900',
    height: 28,
    lineHeight: 26,
    textAlign: 'center',
    width: 28,
  },
  checkBoxActive: {
    backgroundColor: colors.gold,
  },
  paymentName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
  },
  checkLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
  },
  dangerButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212, 87, 59, 0.12)',
    borderColor: colors.danger,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  dangerButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  segment: {
    backgroundColor: colors.black,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 18,
    padding: 4,
  },
  segmentItem: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingVertical: 10,
  },
  segmentItemActive: {
    backgroundColor: colors.gold,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: colors.mustardLight,
  },
});
