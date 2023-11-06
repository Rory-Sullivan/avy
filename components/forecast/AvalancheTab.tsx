import React, {useCallback, useEffect} from 'react';

import {addDays, formatDistanceToNow, isAfter} from 'date-fns';

import {Feather, FontAwesome} from '@expo/vector-icons';
import {useNavigation} from '@react-navigation/native';
import {AvalancheDangerIcon} from 'components/AvalancheDangerIcon';
import {AvalancheDangerTable} from 'components/AvalancheDangerTable';
import {colorFor} from 'components/AvalancheDangerTriangle';
import {AvalancheProblemCard} from 'components/AvalancheProblemCard';
import {InlineDangerScale} from 'components/DangerScale';
import {Card, CollapsibleCard} from 'components/content/Card';
import {InfoTooltip} from 'components/content/InfoTooltip';
import {QueryState, incompleteQueryState} from 'components/content/QueryState';
import {Carousel, images} from 'components/content/carousel';
import {HStack, VStack, View} from 'components/core';
import {AllCapsSm, AllCapsSmBlack, Body, BodyBlack, BodySemibold, BodySm, BodySmBlack, BodySmSemibold, Title3Black, bodySize} from 'components/text';
import {HTML} from 'components/text/HTML';
import helpStrings from 'content/helpStrings';
import {toDate} from 'date-fns-tz';
import {useAvalancheForecast} from 'hooks/useAvalancheForecast';
import {useAvalancheWarning} from 'hooks/useAvalancheWarning';
import {useRefresh} from 'hooks/useRefresh';
import {useToggle} from 'hooks/useToggle';
import {RefreshControl, ScrollView, TouchableOpacity} from 'react-native';
import Collapsible from 'react-native-collapsible';
import Toast from 'react-native-toast-message';
import {HomeStackNavigationProps} from 'routes';
import {colorLookup} from 'theme';
import {COLORS} from 'theme/colors';
import {
  AvalancheCenter,
  AvalancheCenterID,
  AvalancheDangerForecast,
  AvalancheForecastZoneSummary,
  DangerLevel,
  ElevationBandNames,
  ForecastPeriod,
  ProductType,
  Special,
  Warning,
  Watch,
} from 'types/nationalAvalancheCenter';
import {RequestedTime, utcDateToLocalDateString, utcDateToLocalTimeString} from 'utils/date';

interface AvalancheTabProps {
  elevationBandNames: ElevationBandNames;
  center_id: AvalancheCenterID;
  center: AvalancheCenter;
  requestedTime: RequestedTime;
  forecast_zone_id: number;
}

const HeaderWithTooltip: React.FunctionComponent<{
  title: string;
  content: string;
}> = ({title, content}) => (
  // the icon style is designed to make the circle "i" look natural next to the
  // text - neither `center` nor `baseline` alignment look good on their own
  <HStack space={6} alignItems="center">
    <BodyBlack numberOfLines={1}>{title}</BodyBlack>
    <InfoTooltip size={bodySize} title={title} content={content} style={{paddingBottom: 0, paddingTop: 1}} />
  </HStack>
);

export const AvalancheTab: React.FunctionComponent<AvalancheTabProps> = ({elevationBandNames, center_id, center, forecast_zone_id, requestedTime}) => {
  const forecastResult = useAvalancheForecast(center_id, forecast_zone_id, requestedTime, center);
  const forecast = forecastResult.data;
  const warningResult = useAvalancheWarning(center_id, forecast_zone_id, requestedTime);
  const warning = warningResult.data;
  const {isRefreshing, refresh} = useRefresh(forecastResult.refetch, warningResult.refetch);
  const onRefresh = useCallback(() => void refresh(), [refresh]);

  // When navigating from elsewhere in the app, the screen title should already
  // be set to the zone name. But if we warp directly to a forecast link, we
  // need to load the zone name dynamically.
  const navigation = useNavigation<HomeStackNavigationProps>();
  React.useEffect(() => {
    if (forecast) {
      const thisZone: AvalancheForecastZoneSummary | undefined = forecast.forecast_zone.find(zone => zone.id === forecast_zone_id);
      if (thisZone) {
        navigation.setOptions({title: thisZone.name});
      }
    }
  }, [forecast, forecast_zone_id, navigation]);
  React.useEffect(() => {
    return navigation.addListener('beforeRemove', () => {
      Toast.hide();
    });
  }, [navigation]);

  useEffect(() => {
    if (forecast?.expires_time) {
      const expires_time = new Date(forecast.expires_time);
      if (isAfter(new Date(), expires_time)) {
        Toast.show({
          type: 'error',
          text1: `This avalanche forecast expired ${formatDistanceToNow(expires_time)} ago.`,
          autoHide: false,
          position: 'bottom',
          onPress: () => Toast.hide(),
        });
      }
    }
  }, [forecast]);

  if (incompleteQueryState(forecastResult, warningResult) || !forecast || !warning) {
    return <QueryState results={[forecastResult, warningResult]} />;
  }

  const publishedTime = forecast.published_time ? toDate(forecast.published_time) : new Date();

  let currentDanger: AvalancheDangerForecast | undefined = undefined;
  let outlookDanger: AvalancheDangerForecast | undefined = undefined;
  let highestDangerToday: DangerLevel = DangerLevel.None;
  if (forecast.product_type === ProductType.Forecast) {
    currentDanger = forecast.danger?.find(item => item.valid_day === ForecastPeriod.Current);
    if (currentDanger) {
      highestDangerToday = Math.max(currentDanger.lower, currentDanger.middle, currentDanger.upper);
    }
    outlookDanger = forecast.danger.find(item => item.valid_day === ForecastPeriod.Tomorrow);
  }

  const imageItems = images(forecast.media);

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}>
      <VStack space={8} backgroundColor={colorLookup('primary.background')}>
        <Card borderRadius={0} borderColor="white" header={<Title3Black>Avalanche Forecast</Title3Black>}>
          <HStack justifyContent="space-evenly" space={8}>
            <VStack space={8} style={{flex: 1}}>
              <AllCapsSmBlack>Issued</AllCapsSmBlack>
              <AllCapsSm style={{textTransform: 'none'}} color="text.secondary">
                {utcDateToLocalTimeString(forecast.published_time)}
              </AllCapsSm>
            </VStack>
            <VStack space={8} style={{flex: 1}}>
              <AllCapsSmBlack>Expires</AllCapsSmBlack>
              <AllCapsSm style={{textTransform: 'none'}} color="text.secondary">
                {utcDateToLocalTimeString(forecast.expires_time)}
              </AllCapsSm>
            </VStack>
            <VStack space={8} style={{flex: 1}}>
              <AllCapsSmBlack>Author</AllCapsSmBlack>
              <AllCapsSm style={{textTransform: 'none'}} color="text.secondary">
                {forecast.author || 'Unknown'}
                {'\n'}
              </AllCapsSm>
            </VStack>
          </HStack>
        </Card>
        {warning.data && warning.data.expires_time && <WarningCard warning={warning.data} />}
        {forecast.bottom_line && (
          <Card
            borderRadius={0}
            borderColor="white"
            header={
              <HStack space={8} alignItems="center">
                <AvalancheDangerIcon style={{height: 32}} level={highestDangerToday} />
                <BodyBlack>The Bottom Line</BodyBlack>
              </HStack>
            }>
            <HTML source={{html: forecast.bottom_line}} />
          </Card>
        )}
        <Card borderRadius={0} borderColor="white" header={<HeaderWithTooltip title="Avalanche Danger" content={helpStrings.avalancheDanger} />}>
          <AvalancheDangerTable date={addDays(publishedTime, 1)} forecast={currentDanger} elevation_band_names={elevationBandNames} size={'main'} />
        </Card>
        <CollapsibleCard
          startsCollapsed
          borderRadius={0}
          borderColor="white"
          header={<BodySmBlack>{utcDateToLocalDateString(addDays(publishedTime, 2))}</BodySmBlack>}
          noDivider={true}>
          <AvalancheDangerTable forecast={outlookDanger} size={'outlook'} />
        </CollapsibleCard>
        <Card borderRadius={0} borderColor="white" header={<HeaderWithTooltip title="Danger Scale" content={helpStrings.dangerScale} />} noDivider={true}>
          <InlineDangerScale />
        </Card>
        {forecast.product_type === ProductType.Forecast &&
          forecast.forecast_avalanche_problems &&
          forecast.forecast_avalanche_problems.map((problem, index) => (
            <CollapsibleCard
              key={`avalanche-problem-${index}-card`}
              startsCollapsed
              borderRadius={0}
              borderColor="white"
              header={<HeaderWithTooltip title={`Problem #${index + 1}: ${problem.name}`} content={helpStrings.avalancheProblem} />}>
              <AvalancheProblemCard key={`avalanche-problem-${index}`} problem={problem} names={elevationBandNames} />
            </CollapsibleCard>
          ))}
        {forecast.hazard_discussion && (
          <CollapsibleCard startsCollapsed borderRadius={0} borderColor="white" header={<BodyBlack>Forecast Discussion</BodyBlack>}>
            <HTML source={{html: forecast.hazard_discussion}} />
          </CollapsibleCard>
        )}
        {imageItems && (
          <Card borderRadius={0} borderColor="white" header={<BodyBlack>Media</BodyBlack>} noDivider>
            <Carousel thumbnailHeight={160} thumbnailAspectRatio={1.3} media={imageItems} displayCaptions={false} />
          </Card>
        )}
        <View height={16} />
      </VStack>
    </ScrollView>
  );
};

const WarningCard: React.FunctionComponent<{warning: Warning | Watch | Special}> = ({warning}) => {
  const [isCollapsed, {toggle: toggleCollapsed}] = useToggle(true);
  const {accentColor, title} = assetsForType(warning.product_type);

  return (
    <View mx={16} py={16} borderRadius={10} borderColor={'#333333'} backgroundColor={'#333333'}>
      <HStack mx={12} space={16} alignItems={'flex-start'}>
        <View backgroundColor={accentColor} width={8} height={'100%'} borderRadius={12}></View>
        <VStack space={16} flex={1}>
          <VStack space={8}>
            <HStack space={8} alignItems={'flex-start'}>
              <Feather name="alert-triangle" size={24} color={accentColor} />
              <Title3Black color="white">{title}</Title3Black>
            </HStack>
            <VStack>
              <HStack pr={4} space={2}>
                <BodySmSemibold color="white">Issued:</BodySmSemibold>
                <BodySm color="white">{utcDateToLocalTimeString(warning.published_time)}</BodySm>
              </HStack>
              <HStack pr={4} space={2}>
                <BodySmSemibold color="white">Expires:</BodySmSemibold>
                <BodySm color="white">{utcDateToLocalTimeString(warning.expires_time)}</BodySm>
              </HStack>
            </VStack>
          </VStack>
          <View flex={1}>
            <BodySemibold color={'white'}>{warning.bottom_line}</BodySemibold>
          </View>
          <Collapsible collapsed={isCollapsed} renderChildrenCollapsed>
            <VStack space={8} pt={8}>
              <View mr={8} flex={1}>
                <VStack px={4} space={2}>
                  <BodySemibold color="white">What:</BodySemibold>
                  <Body style={{textTransform: 'none'}} color="white">
                    {warning.hazard_discussion}
                  </Body>
                </VStack>
                <VStack px={4} space={2}>
                  <BodySemibold color="white">Where:</BodySemibold>
                  <Body style={{textTransform: 'none'}} color="white">
                    {warning.affected_area}
                  </Body>
                </VStack>
                <VStack px={4} space={2}>
                  <BodySemibold color="white">Why:</BodySemibold>
                  <Body style={{textTransform: 'none'}} color="white">
                    {warning.reason}
                  </Body>
                </VStack>
              </View>
            </VStack>
          </Collapsible>
        </VStack>
        <TouchableOpacity onPress={toggleCollapsed}>
          <HStack mr={12} justifyContent="space-between" alignItems="center">
            <FontAwesome name={isCollapsed ? 'angle-down' : 'angle-up'} color={'white'} backgroundColor={'#333333'} size={24} />
          </HStack>
        </TouchableOpacity>
      </HStack>
    </View>
  );
};

const assetsForType = (productType: ProductType.Warning | ProductType.Watch | ProductType.Special): {title: string; accentColor: string} => {
  switch (productType) {
    case ProductType.Warning:
      return {
        title: `Avalanche Warning`,
        accentColor: colorFor(DangerLevel.High).toString(),
      };
    case ProductType.Watch:
      return {
        title: `Avalanche Watch`,
        accentColor: colorFor(DangerLevel.Considerable).toString(),
      };
    case ProductType.Special:
      return {
        title: `Special Bulletin`,
        accentColor: COLORS.primary.toString(),
      };
  }
  const invalid: never = productType;
  throw new Error(`Unknown avalanche center: ${JSON.stringify(invalid)}`);
};
