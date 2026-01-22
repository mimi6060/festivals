import React, { useCallback, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import {
  POI,
  Stand,
  MapStage,
  Facility,
  getCategoryIcon,
  getCategoryLabel,
  getCategoryColor,
  getStandCategoryIcon,
  POICategory,
} from '@/stores/mapStore';

interface POIBottomSheetProps {
  poi: POI | null;
  onClose: () => void;
  userLocation?: { latitude: number; longitude: number } | null;
}

export interface POIBottomSheetRef {
  expand: () => void;
  collapse: () => void;
  close: () => void;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPrice(price: number): string {
  return `${price.toFixed(2)} EUR`;
}

const StandDetails = ({ stand }: { stand: Stand }) => {
  const availableProducts = stand.products.filter((p) => p.available);
  const unavailableProducts = stand.products.filter((p) => !p.available);

  return (
    <View style={styles.detailsContainer}>
      {/* Opening Hours */}
      <View style={styles.infoRow}>
        <Ionicons name="time-outline" size={18} color="#6B7280" />
        <Text style={styles.infoText}>{stand.openingHours}</Text>
      </View>

      {/* Cashless indicator */}
      {stand.isCashless && (
        <View style={styles.infoRow}>
          <Ionicons name="card-outline" size={18} color="#10B981" />
          <Text style={[styles.infoText, { color: '#10B981' }]}>Paiement cashless uniquement</Text>
        </View>
      )}

      {/* Products */}
      {stand.products.length > 0 && (
        <View style={styles.productsSection}>
          <Text style={styles.sectionTitle}>Produits</Text>

          {availableProducts.map((product) => (
            <View key={product.id} style={styles.productRow}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                {product.description && (
                  <Text style={styles.productDescription}>{product.description}</Text>
                )}
              </View>
              <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
            </View>
          ))}

          {unavailableProducts.length > 0 && (
            <>
              <Text style={styles.unavailableLabel}>Non disponible</Text>
              {unavailableProducts.map((product) => (
                <View key={product.id} style={[styles.productRow, styles.unavailableProduct]}>
                  <Text style={[styles.productName, styles.unavailableText]}>{product.name}</Text>
                  <Text style={[styles.productPrice, styles.unavailableText]}>
                    {formatPrice(product.price)}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
};

const StageDetails = ({ stage }: { stage: MapStage }) => {
  return (
    <View style={styles.detailsContainer}>
      {/* Capacity */}
      <View style={styles.infoRow}>
        <Ionicons name="people-outline" size={18} color="#6B7280" />
        <Text style={styles.infoText}>Capacite: {stage.capacity.toLocaleString()} personnes</Text>
      </View>

      {/* Current Performance */}
      {stage.currentPerformance && (
        <View style={styles.performanceSection}>
          <View style={styles.nowPlayingHeader}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>EN DIRECT</Text>
          </View>
          <View style={styles.performanceCard}>
            <Text style={styles.artistNameLarge}>{stage.currentPerformance.artistName}</Text>
            <Text style={styles.performanceTime}>
              {formatTime(stage.currentPerformance.startTime)} - {formatTime(stage.currentPerformance.endTime)}
            </Text>
          </View>
        </View>
      )}

      {/* Next Performance */}
      {stage.nextPerformance && (
        <View style={styles.performanceSection}>
          <Text style={styles.nextLabel}>A SUIVRE</Text>
          <View style={[styles.performanceCard, styles.nextCard]}>
            <Text style={styles.artistNameMedium}>{stage.nextPerformance.artistName}</Text>
            <Text style={styles.performanceTime}>
              {formatTime(stage.nextPerformance.startTime)} - {formatTime(stage.nextPerformance.endTime)}
            </Text>
          </View>
        </View>
      )}

      {!stage.currentPerformance && !stage.nextPerformance && (
        <View style={styles.noPerformance}>
          <Ionicons name="musical-notes-outline" size={32} color="#D1D5DB" />
          <Text style={styles.noPerformanceText}>Aucune performance programmee pour le moment</Text>
        </View>
      )}
    </View>
  );
};

const FacilityDetails = ({ facility }: { facility: Facility }) => {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'open':
        return '#10B981';
      case 'busy':
        return '#F59E0B';
      case 'closed':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'open':
        return 'Ouvert';
      case 'busy':
        return 'Affluence elevee';
      case 'closed':
        return 'Ferme';
      default:
        return '';
    }
  };

  return (
    <View style={styles.detailsContainer}>
      {/* Status */}
      {facility.status && (
        <View style={styles.infoRow}>
          <View
            style={[styles.statusDot, { backgroundColor: getStatusColor(facility.status) }]}
          />
          <Text style={[styles.infoText, { color: getStatusColor(facility.status) }]}>
            {getStatusLabel(facility.status)}
          </Text>
        </View>
      )}

      {/* Accessibility */}
      {facility.isAccessible && (
        <View style={styles.infoRow}>
          <Ionicons name="accessibility-outline" size={18} color="#6366F1" />
          <Text style={[styles.infoText, { color: '#6366F1' }]}>Accessible PMR</Text>
        </View>
      )}

      {/* Description */}
      {facility.description && (
        <Text style={styles.facilityDescription}>{facility.description}</Text>
      )}
    </View>
  );
};

export const POIBottomSheet = forwardRef<POIBottomSheetRef, POIBottomSheetProps>(
  ({ poi, onClose, userLocation }, ref) => {
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['35%', '70%'], []);

    useImperativeHandle(ref, () => ({
      expand: () => bottomSheetRef.current?.expand(),
      collapse: () => bottomSheetRef.current?.collapse(),
      close: () => bottomSheetRef.current?.close(),
    }));

    const handleSheetChanges = useCallback(
      (index: number) => {
        if (index === -1) {
          onClose();
        }
      },
      [onClose]
    );

    const handleNavigate = useCallback(() => {
      if (!poi) return;

      const { latitude, longitude } = poi.location;
      const label = encodeURIComponent(poi.name);

      // Open in maps app
      const scheme = Platform.select({
        ios: 'maps:',
        android: 'geo:',
      });

      const url = Platform.select({
        ios: `maps:?daddr=${latitude},${longitude}&q=${label}`,
        android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
      });

      if (url) {
        Linking.openURL(url).catch((err) => {
          console.error('Error opening maps:', err);
          // Fallback to Google Maps web
          Linking.openURL(
            `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
          );
        });
      }
    }, [poi]);

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      []
    );

    if (!poi) return null;

    const getIcon = (): string => {
      if (poi.poiType === 'stand') {
        return getStandCategoryIcon(poi.category);
      }
      if (poi.poiType === 'stage') {
        return 'musical-notes-outline';
      }
      return getCategoryIcon(poi.type);
    };

    const getColor = (): string => {
      if (poi.poiType === 'stand') {
        const colorMap: Record<string, string> = {
          food: '#F97316',
          drink: '#EAB308',
          merch: '#EC4899',
          sponsor: '#6366F1',
          craft: '#8B5CF6',
        };
        return colorMap[poi.category] || '#6366F1';
      }
      if (poi.poiType === 'stage') {
        return poi.color;
      }
      return getCategoryColor(poi.type);
    };

    const getCategoryText = (): string => {
      if (poi.poiType === 'stand') {
        const labelMap: Record<string, string> = {
          food: 'Restauration',
          drink: 'Boissons',
          merch: 'Boutique',
          sponsor: 'Partenaire',
          craft: 'Artisanat',
        };
        return labelMap[poi.category] || 'Stand';
      }
      if (poi.poiType === 'stage') {
        return 'Scene';
      }
      return getCategoryLabel(poi.type);
    };

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handleIndicator}
        backgroundStyle={styles.sheetBackground}
      >
        <BottomSheetScrollView contentContainerStyle={styles.contentContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: getColor() }]}>
              <Ionicons name={getIcon() as any} size={24} color="white" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.categoryText}>{getCategoryText()}</Text>
              <Text style={styles.poiName}>{poi.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Description */}
          <Text style={styles.description}>{poi.description}</Text>

          {/* POI-specific details */}
          {poi.poiType === 'stand' && <StandDetails stand={poi as Stand} />}
          {poi.poiType === 'stage' && <StageDetails stage={poi as MapStage} />}
          {poi.poiType === 'facility' && <FacilityDetails facility={poi as Facility} />}

          {/* Navigate Button */}
          <TouchableOpacity
            style={[styles.navigateButton, { backgroundColor: getColor() }]}
            onPress={handleNavigate}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={20} color="white" />
            <Text style={styles.navigateButtonText}>Itineraire</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheet>
    );
  }
);

const styles = StyleSheet.create({
  handleIndicator: {
    backgroundColor: '#D1D5DB',
    width: 40,
  },
  sheetBackground: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  categoryText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  poiName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 16,
  },
  detailsContainer: {
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  productsSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  productDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  unavailableLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 16,
    marginBottom: 8,
  },
  unavailableProduct: {
    opacity: 0.6,
  },
  unavailableText: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  performanceSection: {
    marginTop: 16,
  },
  nowPlayingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  performanceCard: {
    backgroundColor: '#F3F4F6',
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6366F1',
  },
  nextCard: {
    backgroundColor: '#F9FAFB',
    borderLeftColor: '#D1D5DB',
  },
  nextLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  artistNameLarge: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  artistNameMedium: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  performanceTime: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  noPerformance: {
    alignItems: 'center',
    padding: 24,
  },
  noPerformanceText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  facilityDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginTop: 12,
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  navigateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
});

export default POIBottomSheet;
