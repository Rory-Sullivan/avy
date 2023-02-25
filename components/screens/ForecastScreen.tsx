import {StyleSheet} from 'react-native';

import {SafeAreaView} from 'react-native-safe-area-context';

import {NativeStackScreenProps} from '@react-navigation/native-stack';

import {View} from 'components/core';
import {AvalancheForecast} from 'components/forecast/AvalancheForecast';
import {HomeStackParamList} from 'routes';
import {parseRequestedTimeString} from 'utils/date';

export const ForecastScreen = ({route}: NativeStackScreenProps<HomeStackParamList, 'forecast'>) => {
  const {center_id, forecast_zone_id, requestedTime, zoneName} = route.params;
  return (
    // hat tip to https://github.com/react-navigation/react-navigation/issues/8694 for the use of `edges`
    <SafeAreaView style={StyleSheet.absoluteFillObject} edges={['top', 'left', 'right']}>
      <View width="100%" height="100%">
        <AvalancheForecast center_id={center_id} forecast_zone_id={forecast_zone_id} requestedTime={parseRequestedTimeString(requestedTime)} zoneName={zoneName} />
      </View>
    </SafeAreaView>
  );
};
