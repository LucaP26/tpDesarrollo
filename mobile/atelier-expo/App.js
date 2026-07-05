import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { API_BASE_URL, api } from './src/api';
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
  email: 'p@gmail.com',
  password: 'Platino123!',
};

export default function App() {
  const [stack, setStack] = useState([{ name: 'splash', params: {} }]);
  const [auth, setAuth] = useState({ token: null, user: null });
  const route = stack[stack.length - 1];

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
      {route.name === 'home' && <HomeScreen {...commonProps} />}
      {route.name === 'discover' && <DiscoverScreen {...commonProps} />}
      {route.name === 'watchlist' && <WatchlistScreen {...commonProps} />}
      {route.name === 'bids' && <BidsScreen {...commonProps} />}
      {route.name === 'auctionRoom' && <AuctionRoomScreen {...commonProps} auctionId={route.params.auctionId} />}
      {route.name === 'profile' && <ProfileScreen {...commonProps} />}
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

function LoginScreen({ setAuth, replace }) {
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
            <Text style={styles.apiHint}>API: {API_BASE_URL}</Text>
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

function DiscoverScreen({ auth, navigate, goBack, goTab }) {
  const [auctions, setAuctions] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setAuctions((await api.auctions(auth.token)) || []);
    } catch (error) {
      Alert.alert('No pudimos cargar catálogos', error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [auth.token]);

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
    navigate('auctionRoom', { auctionId: auction.id });
  }

  return (
    <Screen footer={<FooterNav active="discover" onNavigate={goTab} />}>
      <ScrollView contentContainerStyle={styles.contentWithFooter}>
        <Header
          title="Catálogos"
          onBack={goBack}
          right={<AvatarButton user={auth.user} onPress={() => navigate('profile')} />}
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
            onToggleWatchlist={() => toggleWatchlist(auction)}
          />
        ))}
        {!loading && filtered.length === 0 ? (
          <Text style={styles.emptyText}>No encontramos catálogos para esa búsqueda.</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function AuctionRoomScreen({ auth, auctionId, goBack, goTab }) {
  const [detail, setDetail] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const data = await api.auctionDetail(auth.token, auctionId);
      setDetail(data);
    } catch (error) {
      Alert.alert('No pudimos cargar la sala', error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [auth.token, auctionId]);

  async function joinIfNeeded() {
    if (!detail || detail.state !== 'abierta') {
      return true;
    }
    try {
      const response = await api.joinAuction(auth.token, auctionId);
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

    setSubmitting(true);
    try {
      const joined = await joinIfNeeded();
      if (!joined) {
        return;
      }
      await api.bid(auth.token, auctionId, lot.id, bidAmount);
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
    <Screen footer={<FooterNav active="discover" onNavigate={goTab} />}>
      <ScrollView contentContainerStyle={styles.contentWithFooter}>
        <Header title="Sala" onBack={goBack} right={<Text style={styles.smallGold}>{categoryLabel(detail?.category)}</Text>} />

        <View style={styles.roomHero}>
          <View style={styles.roomHeroTop}>
            <Text style={styles.categoryTextLarge}>{categoryLabel(detail?.category)}</Text>
            <GhostButton label="ABANDONAR SALA" onPress={leaveAuction} style={styles.leaveButton} />
          </View>
          <Text style={styles.roomTitle}>{detail?.title}</Text>
          <Text style={styles.roomMeta}>{detail?.location} · {detail?.auctioneer_name}</Text>
          <Text style={styles.roomCopy}>
            {upcoming
              ? 'Esta subasta está programada. Podés ver el catálogo, pero las pujas se habilitan cuando abra la sala.'
              : 'La sala muestra un lote a la vez. Cuando se adjudica el lote en exhibición, avanza al siguiente.'}
          </Text>
        </View>

        {currentLot ? (
          <>
            <Text style={styles.sectionTitle}>Lote en sala</Text>
            <LotCard lot={currentLot} currency={detail.currency} active />
            <View style={styles.bidPanel}>
              <Text style={styles.mutedText}>Tiempo restante: {currentLot.bid_seconds_remaining ?? 60}s</Text>
              <Text style={styles.mutedText}>Mínimo: {money(currentLot.min_bid, detail.currency)}</Text>
              {currentLot.max_bid ? <Text style={styles.mutedText}>Máximo: {money(currentLot.max_bid, detail.currency)}</Text> : null}
              <Field label="MONTO A PUJAR" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Ingresá tu oferta" />
              <PrimaryButton
                label={submitting ? 'REGISTRANDO...' : upcoming ? 'PUJA NO DISPONIBLE' : 'PUJAR AHORA'}
                onPress={submitBid}
                disabled={submitting || upcoming}
              />
            </View>
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

function ProfileScreen({ auth, setAuth, goBack, goTab }) {
  const [profile, setProfile] = useState(auth.user);
  const [payments, setPayments] = useState([]);
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
      const [profileData, paymentData] = await Promise.all([
        api.profile(auth.token),
        api.paymentMethods(auth.token).catch(() => []),
      ]);
      setProfile(profileData);
      setAuth((current) => ({ ...current, user: profileData }));
      setPayments(paymentData || []);
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
    if (!paymentForm.holder_first_name || !paymentForm.holder_last_name) {
      Alert.alert('Datos obligatorios', 'Completá nombre y apellido del titular.');
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

    const payload = {
      type: paymentForm.type,
      display_name: paymentDisplayName(paymentForm),
      currency: paymentForm.currency,
      issuer_country: 'AR',
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

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Información personal</Text>
          <Pressable onPress={() => setEditing((value) => !value)}>
            <Text style={styles.inlineAction}>{editing ? 'CANCELAR' : 'EDITAR'}</Text>
          </Pressable>
        </View>

        <Field label="NOMBRE" value={form.first_name} onChangeText={(value) => setForm({ ...form, first_name: value })} editable={editing} />
        <Field label="APELLIDO" value={form.last_name} onChangeText={(value) => setForm({ ...form, last_name: value })} editable={editing} />
        <Field label="MAIL" value={form.email} onChangeText={(value) => setForm({ ...form, email: value })} editable={editing} />
        <Field label="DIRECCIÓN LEGAL" value={form.legal_address} onChangeText={(value) => setForm({ ...form, legal_address: value })} editable={editing} />
        {editing ? <PrimaryButton label="GUARDAR CAMBIOS" onPress={saveProfile} /> : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Medios de pago</Text>
          <Pressable onPress={() => setShowPaymentForm((value) => !value)}>
            <Text style={styles.inlineAction}>{showPaymentForm ? 'CERRAR' : 'AGREGAR'}</Text>
          </Pressable>
        </View>

        {payments.map((payment) => (
          <View key={payment.id} style={styles.paymentRow}>
            <View>
              <Text style={styles.paymentName}>{payment.display_name}</Text>
              <Text style={styles.mutedText}>{payment.currency} · {payment.status}</Text>
            </View>
            <Pressable onPress={() => deletePayment(payment)}>
              <Text style={styles.deleteText}>ELIMINAR</Text>
            </Pressable>
          </View>
        ))}

        {showPaymentForm ? (
          <View style={styles.panel}>
            <PaymentTypeSelector value={paymentForm.type} onChange={(type) => setPaymentForm({ ...paymentForm, type })} />
            <Field label="NOMBRE TITULAR" value={paymentForm.holder_first_name} onChangeText={(value) => setPaymentForm({ ...paymentForm, holder_first_name: value })} />
            <Field label="APELLIDO TITULAR" value={paymentForm.holder_last_name} onChangeText={(value) => setPaymentForm({ ...paymentForm, holder_last_name: value })} />
            <Field label="MONEDA" value={paymentForm.currency} onChangeText={(value) => setPaymentForm({ ...paymentForm, currency: value.toUpperCase() })} />
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
    issuing_bank: 'Galicia',
    card_number: '',
    expiration_date: '',
    available_amount: '',
  };
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
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
  },
  apiHint: {
    color: colors.goldDark,
    fontSize: 11,
    marginTop: 14,
    textAlign: 'center',
  },
  contentWithFooter: {
    padding: spacing.screen,
    paddingBottom: 116,
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
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
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
    fontFamily: fonts.serif,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 14,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
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
    marginTop: 12,
  },
  panelTitle: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 10,
  },
  profileHero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  profileAvatarWrap: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.gold,
    borderRadius: 76,
    borderWidth: 2,
    height: 142,
    justifyContent: 'center',
    marginBottom: 16,
    width: 142,
  },
  profileAvatar: {
    borderRadius: 68,
    height: 132,
    width: 132,
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
    tintColor: colors.black,
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
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
  },
  profileCategory: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: 8,
  },
  inlineAction: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 3,
  },
  paymentRow: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: 16,
  },
  paymentName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  deleteText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  segment: {
    backgroundColor: colors.black,
    borderRadius: 999,
    flexDirection: 'row',
    marginBottom: 18,
    padding: 4,
  },
  segmentItem: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
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
    color: colors.black,
  },
});
