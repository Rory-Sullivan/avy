import React from 'react';

import {Box, VStack, HStack, Text as NBText} from 'native-base';
import {Text, SectionList, SectionListData, StyleSheet, TouchableOpacity, ActivityIndicator} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import {AvalancheCenterLogo} from './AvalancheCenterLogo';
import {useAvalancheCenterMetadata} from 'hooks/useAvalancheCenterMetadata';
import {TabNavigationProps} from 'routes';

const center_idsByType: SectionListData<string>[] = [
  {
    title: 'Forest Service',
    data: [
      'BTAC', // Bridger-Teton: ID, WY
      'CNFAIC', // Chugach: AK
      'FAC', // Flathead: MT
      'GNFAC', // Gallatin: MT, WY, ID
      'IPAC', // Idaho Panhandle: ID, MT
      'NWAC', // Northwest: WA, OR
      'MSAC', // Mount Shasta: CA
      'MWAC', // Mount Washington: NH
      'PAC', // Payette: ID
      'SNFAC', // Sawtooths: ID
      'SAC', // Sierra: CA
      'WCMAC', // West Central Montana: MT
    ],
  },
  {
    title: 'State',
    data: [
      'CAIC', // Colorado: CO
    ],
  },
  {
    title: 'Local Non-Profit',
    data: [
      'COAA', // Central Oregon: OR
      'CBAC', // Crested Butte: CO
      'ESAC', // Eastern Sierra: CA
      'WAC', // Wallowas: OR
    ],
  },
];

interface AvalancheCenterCardProps {
  center_id: string;
  selected: boolean;
  onPress: (center_id: string) => void;
}

export const AvalancheCenterCard: React.FunctionComponent<AvalancheCenterCardProps> = ({center_id, selected, onPress}: AvalancheCenterCardProps) => {
  const {isLoading, isError, data: avalancheCenter, error} = useAvalancheCenterMetadata(center_id);
  if (isLoading) {
    return <ActivityIndicator style={styles.item} />;
  }
  if (isError) {
    return (
      <Box px="2" pt="2">
        <Box bg="white" borderWidth="2" borderRadius="8" borderColor="light.200" p="4">
          <VStack space="2">
            <HStack justifyContent="space-between" pt="4">
              <NBText color="light.400">{`Could not fetch data for ${center_id}: ${error?.message}.`}</NBText>
            </HStack>
          </VStack>
        </Box>
      </Box>
    );
  }
  if (!avalancheCenter) {
    return (
      <Box px="2" pt="2">
        <Box bg="white" borderWidth="2" borderRadius="8" borderColor="light.200" p="4">
          <VStack space="2">
            <HStack justifyContent="space-between" pt="4">
              <NBText color="light.400">{`No metadata found for ${center_id}.`}</NBText>
            </HStack>
          </VStack>
        </Box>
      </Box>
    );
  }

  return (
    <Box px="2" pt="2">
      <TouchableOpacity
        style={styles.item}
        onPress={() => {
          onPress(center_id);
        }}>
        <Box bg={selected ? 'red.400' : 'white'} borderWidth="2" borderRadius="8" borderColor="light.200" p="4">
          <VStack space="2">
            <HStack justifyContent="space-between" pt="4">
              <AvalancheCenterLogo style={styles.logo} center_id={center_id} />
              <NBText color="light.400">{avalancheCenter.name}</NBText>
            </HStack>
          </VStack>
        </Box>
      </TouchableOpacity>
    </Box>
  );
};

export const AvalancheCenterSelector = ({currentCenterId, setAvalancheCenter}) => {
  const navigation = useNavigation<TabNavigationProps>();
  return (
    <SectionList
      style={styles.container}
      sections={center_idsByType}
      keyExtractor={item => item}
      renderItem={({item}) => (
        <AvalancheCenterCard
          center_id={item}
          selected={item === currentCenterId}
          onPress={(center_id: string) => {
            setAvalancheCenter(center_id);
            // We need to clear navigation state to force all screens from the
            // previous avalanche center selection to unmount
            navigation.reset({
              index: 0,
              routes: [{name: 'Home'}],
            });
          }}
        />
      )}
      renderSectionHeader={({section: {title}}) => <Text style={styles.title}>{title + ' Centers'}</Text>}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  item: {
    height: 60,
    padding: 2,
    flexDirection: 'row',
    textAlignVertical: 'center',
  },
  logo: {
    height: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    padding: 10,
    paddingBottom: 5,
    elevation: 4,
  },
});
