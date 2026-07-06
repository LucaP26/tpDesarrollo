import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { appAssets, imageSource } from './assets';
import { colors, fonts } from './theme';

export function BrandTitle({ size = 34 }) {
  return <Text style={[styles.brand, { fontSize: size }]}>ATELIER</Text>;
}

export function PrimaryButton({ label, onPress, disabled = false, style }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({ label, onPress, style }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed, style]}>
      <Text style={styles.ghostButtonText}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  editable = true,
  multiline = false,
  numberOfLines = 1,
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        editable={editable}
        autoCapitalize="none"
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.inputMultiline, !editable && styles.inputDisabled]}
      />
    </View>
  );
}

export function FooterNav({ active, onNavigate }) {
  const tabs = [
    { key: 'home', label: 'HOME', icon: '⌂' },
    { key: 'discover', label: 'DISCOVER', icon: '⊙' },
    { key: 'watchlist', label: 'WATCHLIST', icon: '♡' },
    { key: 'bids', label: 'PUJAS', image: appAssets.hammer },
  ];

  return (
    <View style={styles.footer}>
      {tabs.map((tab) => {
        const selected = active === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onNavigate(tab.key)}
            style={[styles.footerItem, selected && styles.footerItemActive]}
          >
            {tab.image ? (
              <Image source={tab.image} style={[styles.footerImage, selected && styles.footerImageActive]} />
            ) : (
              <Text style={[styles.footerIcon, selected && styles.footerIconActive]}>{tab.icon}</Text>
            )}
            <Text style={[styles.footerLabel, selected && styles.footerLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Header({ title, onBack, right }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.headerButton}>
        <Text style={styles.headerBack}>{onBack ? '<' : ''}</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerButton}>{right}</View>
    </View>
  );
}

export function AvatarButton({ user, onPress, size = 44 }) {
  const avatar = imageSource(user?.avatar_image_url);
  return (
    <Pressable onPress={onPress} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {avatar ? (
        <Image source={avatar} style={[styles.avatarImage, { borderRadius: size / 2 }]} />
      ) : (
        <Text style={styles.avatarInitial}>{(user?.first_name || user?.email || 'A').slice(0, 1).toUpperCase()}</Text>
      )}
    </Pressable>
  );
}

export function AuctionCard({ auction, onPress, onToggleWatchlist }) {
  const preview = imageSource(auction.preview_image_url);
  const isUpcoming = auction.state === 'programada';
  return (
    <Pressable onPress={onPress} style={styles.auctionCard}>
      {preview ? <Image source={preview} style={styles.auctionImage} resizeMode="cover" /> : <View style={styles.imageEmpty} />}
      <View style={styles.auctionBody}>
        <View style={styles.cardMetaRow}>
          <Text style={styles.categoryText}>{categoryLabel(auction.category)}</Text>
          {onToggleWatchlist ? (
            <Pressable onPress={onToggleWatchlist} hitSlop={10}>
              <Text style={[styles.heart, auction.in_watchlist && styles.heartFilled]}>{auction.in_watchlist ? '♥' : '♡'}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.auctionTitle}>{auction.title}</Text>
        <Text style={styles.mutedText}>{auction.location}</Text>
        <Text style={styles.mutedText}>
          {isUpcoming ? 'Programada' : 'En vivo'} · {auction.total_lots || 0} piezas
        </Text>
        <View style={styles.cardFooterRow}>
          <Text style={styles.priceText}>{auction.price_available === false ? 'Precio visible al registrarte' : money(auction.preview_base_price, auction.currency)}</Text>
          <View style={styles.enterPill}>
            <Text style={styles.enterPillText}>ENTRAR</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function LotCard({ lot, currency, active = false }) {
  const source = imageSource(lot.image_urls?.[0]);
  return (
    <View style={styles.lotCard}>
      {source ? <Image source={source} style={styles.lotImage} resizeMode="cover" /> : <View style={styles.imageEmpty} />}
      <View style={styles.lotBody}>
        <Text style={styles.livePill}>{active ? 'EN VIVO' : lot.sold ? 'ADJUDICADO' : 'EN CATÁLOGO'}</Text>
        <Text style={styles.lotPiece}>{lot.piece_number}</Text>
        <Text style={styles.lotTitle}>{lot.title}</Text>
        <Text style={styles.lotDescription}>{lot.description}</Text>
        {lot.owner_name || lot.artist ? (
          <Text style={styles.lotMeta}>
            {[lot.owner_name ? `Dueno actual: ${lot.owner_name}` : null, lot.artist ? `Artista/disenador: ${lot.artist}` : null]
              .filter(Boolean)
              .join('  |  ')}
          </Text>
        ) : null}
        {lot.story ? <Text style={styles.lotStory}>{lot.story}</Text> : null}
        <Text style={styles.priceText}>{lot.price_available === false ? 'Precio visible al registrarte' : money(lot.current_bid || lot.base_price, currency)}</Text>
      </View>
    </View>
  );
}

export function money(value, currency = 'USD') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'Sin precio';
  }
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function categoryLabel(value) {
  const labels = {
    comun: 'COMÚN',
    especial: 'ESPECIAL',
    plata: 'PLATA',
    oro: 'ORO',
    platino: 'PLATINO',
  };
  return labels[value] || String(value || '').toUpperCase();
}

const styles = StyleSheet.create({
  brand: {
    color: colors.gold,
    fontFamily: fonts.serif,
    fontWeight: '600',
    letterSpacing: 10,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: colors.mustardLight,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    lineHeight: 18,
    textAlign: 'center',
  },
  ghostButton: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.goldDark,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  ghostButtonText: {
    color: colors.goldSoft,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    lineHeight: 18,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.45,
  },
  fieldBlock: {
    gap: 9,
    marginBottom: 18,
  },
  fieldLabel: {
    color: colors.goldSoft,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  input: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  inputMultiline: {
    minHeight: 104,
    paddingTop: 15,
  },
  inputDisabled: {
    color: colors.muted,
    opacity: 0.78,
  },
  footer: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#11100e',
    borderRadius: 30,
    bottom: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    left: 14,
    padding: 8,
    position: 'absolute',
    right: 14,
  },
  footerItem: {
    alignItems: 'center',
    borderRadius: 22,
    flex: 1,
    gap: 4,
    paddingVertical: 10,
  },
  footerItemActive: {
    backgroundColor: colors.panelSoft,
  },
  footerIcon: {
    color: colors.paper,
    fontSize: 22,
  },
  footerIconActive: {
    color: colors.gold,
  },
  footerImage: {
    height: 22,
    opacity: 0.78,
    tintColor: colors.paper,
    width: 22,
  },
  footerImageActive: {
    opacity: 1,
    tintColor: colors.gold,
  },
  footerLabel: {
    color: colors.paper,
    fontSize: 10,
    fontWeight: '800',
  },
  footerLabelActive: {
    color: colors.gold,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    minWidth: 44,
    paddingHorizontal: 4,
  },
  headerBack: {
    color: colors.gold,
    fontSize: 28,
    fontWeight: '800',
  },
  headerTitle: {
    color: colors.text,
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    textAlign: 'center',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.gold,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarInitial: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '900',
  },
  auctionCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 18,
    overflow: 'hidden',
  },
  auctionImage: {
    backgroundColor: colors.panelSoft,
    height: 220,
    width: '100%',
  },
  imageEmpty: {
    backgroundColor: colors.panelSoft,
    height: 220,
    width: '100%',
  },
  auctionBody: {
    gap: 10,
    padding: 18,
  },
  cardMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 4,
  },
  heart: {
    color: colors.paper,
    fontSize: 28,
  },
  heartFilled: {
    color: colors.gold,
  },
  auctionTitle: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 33,
  },
  mutedText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
  },
  cardFooterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    marginTop: 8,
  },
  priceText: {
    color: colors.goldSoft,
    fontSize: 18,
    fontWeight: '900',
  },
  enterPill: {
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  enterPillText: {
    color: colors.mustardLight,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  lotCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 18,
    overflow: 'hidden',
  },
  lotImage: {
    backgroundColor: colors.panelSoft,
    height: 260,
    width: '100%',
  },
  lotBody: {
    gap: 10,
    padding: 18,
  },
  livePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gold,
    borderRadius: 999,
    color: colors.mustardLight,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  lotPiece: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },
  lotTitle: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
  },
  lotDescription: {
    color: colors.paper,
    fontSize: 15,
    lineHeight: 23,
  },
  lotMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  lotStory: {
    color: colors.paper,
    fontSize: 14,
    lineHeight: 22,
  },
});
