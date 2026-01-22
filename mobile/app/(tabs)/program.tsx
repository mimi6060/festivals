import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

const days = ['Ven 15', 'Sam 16', 'Dim 17'];

const lineup = {
  'Ven 15': [
    { stage: 'Main Stage', artists: [
      { name: 'DJ Alice', time: '20:00', duration: '2h', favorited: false },
      { name: 'DJ Max', time: '22:00', duration: '2h', favorited: true },
      { name: 'The Band', time: '00:00', duration: '1h30', favorited: false },
    ]},
    { stage: 'Techno Tent', artists: [
      { name: 'DJ Bob', time: '21:00', duration: '2h', favorited: false },
      { name: 'Techno Duo', time: '23:00', duration: '2h', favorited: false },
    ]},
  ],
  'Sam 16': [],
  'Dim 17': [],
};

export default function ProgramScreen() {
  const [selectedDay, setSelectedDay] = useState(days[0]);
  const [searchQuery, setSearchQuery] = useState('');

  const dayLineup = lineup[selectedDay as keyof typeof lineup] || [];

  return (
    <View className="flex-1 bg-gray-50">
      {/* Day tabs */}
      <View className="flex-row bg-white border-b border-gray-200">
        {days.map((day) => (
          <TouchableOpacity
            key={day}
            onPress={() => setSelectedDay(day)}
            className={`flex-1 py-4 ${
              selectedDay === day ? 'border-b-2 border-primary' : ''
            }`}
          >
            <Text
              className={`text-center font-medium ${
                selectedDay === day ? 'text-primary' : 'text-gray-500'
              }`}
            >
              {day}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView className="flex-1 p-4">
        {dayLineup.map((stage) => (
          <View key={stage.stage} className="mb-6">
            <Text className="text-lg font-semibold text-gray-700 mb-3">
              🎵 {stage.stage}
            </Text>

            {stage.artists.map((artist) => (
              <View
                key={artist.name}
                className="bg-white rounded-xl p-4 mb-2 flex-row justify-between items-center"
              >
                <View>
                  <Text className="font-semibold text-gray-900">{artist.name}</Text>
                  <Text className="text-gray-500 text-sm">
                    {artist.time} · {artist.duration}
                  </Text>
                </View>
                <TouchableOpacity>
                  <Ionicons
                    name={artist.favorited ? 'heart' : 'heart-outline'}
                    size={24}
                    color={artist.favorited ? '#EF4444' : '#9CA3AF'}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}

        {dayLineup.length === 0 && (
          <View className="items-center py-8">
            <Text className="text-gray-500">Programme à venir</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
