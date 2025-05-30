import React, {useCallback} from 'react';

import {startCase} from 'lodash';

import {AntDesign} from '@expo/vector-icons';
import {zodResolver} from '@hookform/resolvers/zod';
import {SelectModalProvider} from '@mobile-reality/react-native-select-pro';
import {useBackHandler} from '@react-native-community/hooks';
import {useFocusEffect} from '@react-navigation/native';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import {Button} from 'components/content/Button';
import {HStack, VStack, View} from 'components/core';
import {CheckboxSelectField} from 'components/form/CheckboxSelectField';
import {DateField} from 'components/form/DateField';
import {SwitchField} from 'components/form/SwitchField';
import {BodyBlack, BodySemibold, BodySmBlack, Title3Semibold} from 'components/text';
import {endOfDay, isAfter, isBefore, parseISO} from 'date-fns';
import {LoggerContext, LoggerProps} from 'loggerContext';
import {usePostHog} from 'posthog-react-native';
import {FieldErrors, FormProvider, useForm} from 'react-hook-form';
import {KeyboardAvoidingView, Platform, View as RNView, SafeAreaView, ScrollView, TouchableOpacity, findNodeHandle} from 'react-native';
import {colorLookup} from 'theme';
import {MapLayer, ObservationFragment, PartnerType} from 'types/nationalAvalancheCenter';
import {RequestedTime, requestedTimeToUTCDate} from 'utils/date';
import {z} from 'zod';

const avalancheInstabilitySchema = z.enum(['observed', 'triggered', 'caught']);
type avalancheInstability = z.infer<typeof avalancheInstabilitySchema>;

const observationFilterConfigSchema = z.object({
  zones: z.array(z.string()),
  dates: z
    .object({
      from: z.date(),
      to: z.date(),
    })
    .or(
      z.object({
        from: z.null(),
        to: z.null(),
      }),
    )
    .nullable(),
  observerTypes: z.array(z.nativeEnum(PartnerType)),
  avalanches: z.array(avalancheInstabilitySchema),
  cracking: z.boolean(),
  collapsing: z.boolean(),
});

export type ObservationFilterConfig = z.infer<typeof observationFilterConfigSchema>;

type FilterFunction = (observation: ObservationFragment) => boolean;

export const createDefaultFilterConfig = (defaults: Partial<ObservationFilterConfig> | undefined): ObservationFilterConfig => {
  return {
    zones: [],
    observerTypes: [],
    avalanches: [],
    cracking: false,
    collapsing: false,
    dates: null,
    ...defaults,
  };
};

export const dateLabelForFilterConfig = (dates: z.infer<typeof observationFilterConfigSchema.shape.dates>): string => {
  if (!dates) {
    return '';
  }
  if (!dates?.from || !dates?.to) {
    throw new Error('custom date range requires from and to dates');
  }
  return `${dates.from.toDateString()} - ${dates.to.toDateString()}`;
};

const matchesDates = (dates: z.infer<typeof observationFilterConfigSchema.shape.dates>): FilterFunction => {
  if (!dates || !dates?.from || !dates?.to) {
    return () => true;
  }
  const {from: startDate, to: endDate} = dates;
  return (observation: ObservationFragment) => isAfter(parseISO(observation.startDate), startDate) && isBefore(parseISO(observation.startDate), endDate);
};

const matchesInstability = ({cracking, collapsing}: {cracking: boolean; collapsing: boolean}, observation: ObservationFragment): boolean =>
  !!((cracking && observation.instability?.cracking) || (collapsing && observation.instability?.collapsing));

const matchesAvalanches = (avalanches: avalancheInstability[], observation: ObservationFragment): boolean => {
  return avalanches.some(avalanche => {
    switch (avalanche) {
      case 'observed':
        return observation.instability?.avalanches_observed ?? false;
      case 'triggered':
        return observation.instability?.avalanches_triggered ?? false;
      case 'caught':
        return observation.instability?.avalanches_caught ?? false;
    }
    const invalid: never = avalanche;
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new Error(`Unknown instability: ${invalid}`);
  });
};

interface FilterListItem {
  type: 'date' | 'zone' | 'observer' | 'instability' | 'avalanche';
  filter: FilterFunction;
  label: string;
  removeFilter?: (config: ObservationFilterConfig) => ObservationFilterConfig;
}
export const filtersForConfig = (mapLayer: MapLayer, config: ObservationFilterConfig, additionalFilters: Partial<ObservationFilterConfig> | undefined): FilterListItem[] => {
  if (!config) {
    return [];
  }

  const filterFuncs: FilterListItem[] = [];
  if (config.dates && config.dates.from && config.dates.to) {
    filterFuncs.push({
      type: 'date',
      filter: matchesDates(config.dates),
      label: dateLabelForFilterConfig(config.dates),
      removeFilter: (config: ObservationFilterConfig) => ({...config, dates: null}),
    });
  }

  if (config.zones.length > 0) {
    filterFuncs.push({
      type: 'zone',
      filter: (observation: ObservationFragment) => config.zones.includes(matchesZone(mapLayer, observation.locationPoint?.lat, observation.locationPoint?.lng)),
      removeFilter: additionalFilters?.zones ? undefined : (config: ObservationFilterConfig) => ({...config, zones: []}),
      label: config.zones.join(', '),
    });
  }

  if (config.observerTypes.length > 0) {
    filterFuncs.push({
      type: 'observer',
      filter: (observation: ObservationFragment) => config.observerTypes.includes(observation.observerType),
      removeFilter: (config: ObservationFilterConfig) => ({...config, observerTypes: []}),
      label: config.observerTypes.map(startCase).join(', '),
    });
  }

  if (config.avalanches.length > 0) {
    filterFuncs.push({
      type: 'avalanche',
      filter: (observation: ObservationFragment) => matchesAvalanches(config.avalanches, observation),
      removeFilter: (config: ObservationFilterConfig) => ({...config, avalanches: []}),
      label: config.avalanches.map(startCase).join(', '),
    });
  }

  if (config.cracking || config.collapsing) {
    const labelStrings: string[] = [];
    if (config.cracking) {
      labelStrings.push('cracking');
    }
    if (config.collapsing) {
      labelStrings.push('collapsing');
    }

    filterFuncs.push({
      type: 'instability',
      filter: observation => matchesInstability(config, observation),
      label: labelStrings.map(startCase).join(', '),
      removeFilter: config => ({...config, cracking: false, collapsing: false}),
    });
  }

  return filterFuncs;
};

interface ObservationsFilterFormProps {
  requestedTime: RequestedTime;
  mapLayer: MapLayer;
  initialFilterConfig: ObservationFilterConfig;
  currentFilterConfig: ObservationFilterConfig;
  setFilterConfig: React.Dispatch<React.SetStateAction<ObservationFilterConfig>>;
  setVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const formFieldSpacing = 16;

export const ObservationsFilterForm: React.FunctionComponent<ObservationsFilterFormProps> = ({
  requestedTime,
  mapLayer,
  initialFilterConfig,
  currentFilterConfig,
  setFilterConfig,
  setVisible,
}) => {
  const {logger} = React.useContext<LoggerProps>(LoggerContext);
  const formContext = useForm({
    defaultValues: initialFilterConfig,
    resolver: zodResolver(observationFilterConfigSchema),
    mode: 'onBlur',
    shouldFocusError: false,
    shouldUnregister: true,
  });
  React.useEffect(() => {
    formContext.reset(currentFilterConfig);
  }, [formContext, currentFilterConfig]);

  const onCloseHandler = React.useCallback(() => {
    formContext.reset(initialFilterConfig);
    setVisible(false);
  }, [initialFilterConfig, formContext, setVisible]);

  useBackHandler(() => {
    onCloseHandler();
    // Returning true marks the event as processed
    return true;
  });

  const postHog = usePostHog();

  const recordAnalytics = useCallback(() => {
    postHog?.screen('observationsFilter');
  }, [postHog]);
  useFocusEffect(recordAnalytics);

  const onResetHandler = useCallback(() => formContext.reset(initialFilterConfig), [formContext, initialFilterConfig]);

  const onSubmitHandler = useCallback(
    (data: ObservationFilterConfig) => {
      if (data.dates !== null) {
        if (data.dates.from && data.dates.to) {
          // When the user specifies a date range, make sure it runs until midnight of the last day
          data.dates = {
            from: data.dates.from,
            to: endOfDay(data.dates.to),
          };
        } else {
          data.dates = null;
        }
      }
      setFilterConfig(data);
    },
    [setFilterConfig],
  );

  const fieldRefs = React.useRef<{ref: RNView; field: keyof ObservationFilterConfig}[]>([]);
  const scrollViewRef = React.useRef<ScrollView>(null);

  const onSubmitErrorHandler = useCallback(
    (errors: FieldErrors<ObservationFilterConfig>) => {
      logger.error({errors: errors, formValues: formContext.getValues()}, 'filters error');
      // scroll to the first field with an error
      fieldRefs.current.some(({ref, field}) => {
        if (errors[field] && scrollViewRef.current) {
          const handle = findNodeHandle(scrollViewRef.current);
          if (handle) {
            ref.measureLayout(
              handle,
              (_left, top) => {
                if (scrollViewRef.current) {
                  scrollViewRef.current.scrollTo({y: top});
                }
              },
              () => undefined,
            );
            return true;
          }
        }
        return false;
      });
    },
    [formContext, logger],
  );

  const onApplyHandler = useCallback(
    () =>
      void (async () => {
        // Force validation errors to show up on fields that haven't been visited yet
        await formContext.trigger();
        // Then try to submit the form
        await formContext.handleSubmit(onSubmitHandler, onSubmitErrorHandler)();
        // Finally, close the modal
        setVisible(false);
      })(),
    [formContext, onSubmitHandler, onSubmitErrorHandler, setVisible],
  );

  const minMaxDates = {
    max: requestedTimeToUTCDate(requestedTime),
  };

  return (
    <FormProvider {...formContext}>
      <SelectModalProvider>
        <SafeAreaView style={{flex: 1, height: '100%'}}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1, height: '100%'}}>
            <ScrollView style={{height: '100%', width: '100%', backgroundColor: 'white'}} ref={scrollViewRef}>
              <VStack space={12} pt={4}>
                <HStack justifyContent={'space-between'} alignItems={'center'} px={16}>
                  <TouchableOpacity onPress={onCloseHandler}>
                    <AntDesign name="close" size={24} color="black" />
                  </TouchableOpacity>
                  <Title3Semibold>Filters</Title3Semibold>
                  <TouchableOpacity onPress={onResetHandler}>
                    <BodyBlack color={colorLookup('blue2')}>Reset</BodyBlack>
                  </TouchableOpacity>
                </HStack>
                <VStack space={formFieldSpacing} pt={formFieldSpacing} backgroundColor={colorLookup('primary.background')}>
                  <View px={16} pt={16}>
                    <BodyBlack>Date</BodyBlack>
                  </View>
                  <VStack space={8} px={16} bg="white">
                    <View bg="white">
                      <BodySmBlack>From</BodySmBlack>
                    </View>
                    <View bg="white">
                      <DateField name="dates.from" maximumDate={minMaxDates.max} />
                    </View>
                    <View bg="white">
                      <BodySmBlack>To</BodySmBlack>
                    </View>
                    <View bg="white" pb={formFieldSpacing}>
                      <DateField name="dates.to" maximumDate={minMaxDates.max} />
                    </View>
                  </VStack>
                  {mapLayer && (
                    <View px={16} pt={16}>
                      <BodyBlack>Zone</BodyBlack>
                    </View>
                  )}
                  {mapLayer && (
                    <CheckboxSelectField
                      name="zones"
                      items={
                        initialFilterConfig.zones.length > 0
                          ? initialFilterConfig.zones.map(z => ({label: z, value: z}))
                          : mapLayer.features.map(feature => ({label: feature.properties.name, value: feature.properties.name}))
                      }
                      disabled={initialFilterConfig.zones.length > 0}
                      px={16}
                    />
                  )}
                  <View px={16} pt={16}>
                    <BodyBlack>Observer Type</BodyBlack>
                  </View>
                  <CheckboxSelectField
                    name="observerTypes"
                    items={[
                      {value: PartnerType.Forecaster, label: 'Forecaster'},
                      {value: PartnerType.Intern, label: 'Intern'},
                      {value: PartnerType.Professional, label: 'Professional'},
                      {value: PartnerType.Observer, label: 'Observer'},
                      {value: PartnerType.Educator, label: 'Educator'},
                      {value: PartnerType.Volunteer, label: 'Volunteer'},
                      {value: PartnerType.Public, label: 'Public'},
                      {value: PartnerType.Other, label: 'Other'},
                    ]}
                    px={16}
                  />
                  <View px={16} pt={16}>
                    <BodyBlack>Avalanches</BodyBlack>
                  </View>
                  <CheckboxSelectField
                    name="avalanches"
                    items={[
                      {value: 'observed', label: 'Observed'},
                      {value: 'triggered', label: 'Triggered'},
                      {value: 'caught', label: 'Caught'},
                    ]}
                    px={16}
                  />
                  <View px={16} pt={16}>
                    <BodyBlack>Snowpack Cracking</BodyBlack>
                  </View>
                  <SwitchField
                    name="cracking"
                    items={[
                      {label: 'No', value: false},
                      {label: 'Yes', value: true},
                    ]}
                    pb={formFieldSpacing}
                    px={16}
                  />
                  <View px={16}>
                    <BodyBlack>Snowpack Collapsing</BodyBlack>
                  </View>
                  <SwitchField
                    name="collapsing"
                    items={[
                      {label: 'No', value: false},
                      {label: 'Yes', value: true},
                    ]}
                    pb={formFieldSpacing}
                    px={16}
                  />
                </VStack>
              </VStack>
            </ScrollView>
            <Button mx={16} mt={16} buttonStyle="primary" onPress={onApplyHandler}>
              <BodySemibold>Apply Filters</BodySemibold>
            </Button>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SelectModalProvider>
    </FormProvider>
  );
};

export const matchesZone = (mapLayer: MapLayer, lat: number | null | undefined, long: number | null | undefined): string => {
  if (!lat || !long) {
    return 'Unknown Zone';
  }
  const matchingFeatures = mapLayer.features
    .filter(feature => (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') && booleanPointInPolygon([long, lat], feature.geometry))
    .map(feature => feature.properties.name);
  if (matchingFeatures.length === 0) {
    return 'Unknown Zone';
  } else if (matchingFeatures.length > 1) {
    // TODO: this happens almost 100% ... why?
    // also, seems like the widget is naming things with more specificity than just the forecast zones? e.g. teton village
    // log.info(`(${long},${lat}) matched ${matchingFeatures.length} features: ${matchingFeatures}`);
  }
  return matchingFeatures[0];
};
