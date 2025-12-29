// import React, { useState } from "react";
// import { Modal, StyleSheet, TouchableOpacity, View } from "react-native";
// import { Colors } from "../../../components/Background";

// interface Task {
//   id: string;
//   user_id: string;
//   text: string;
//   completed: boolean;
//   focus_time: number;
//   completion_count: number;
//   created_at: string;
//   updated_at: string;
// }

// interface ActionMenuProps {
//   tasks: Task[];
// }

// const actionMenu = ({ tasks }: ActionMenuProps) => {
//   const [showActionMenu, setShowActionMenu] = useState(false);
//   const [selectedTaskForAction, setSelectedTaskForAction] = useState<
//     string | null
//   >(null);

//   return (
//     <Modal
//       visible={showActionMenu}
//       transparent
//       animationType="fade"
//       onRequestClose={() => {
//         setShowActionMenu(false);
//         setSelectedTaskForAction(null);
//       }}
//     >
//       <TouchableOpacity
//         style={styles.actionMenuOverlay}
//         activeOpacity={1}
//         onPress={() => {
//           setShowActionMenu(false);
//           setSelectedTaskForAction(null);
//         }}
//       >
//         <View style={styles.actionMenuContent}>
//           <View style={styles.actionMenuHeader}>
//             <Text style={styles.actionMenuTitle}>Task Actions</Text>
//           </View>

//           <TouchableOpacity
//             style={styles.actionMenuItem}
//             onPress={() => {
//               const task = tasks.find((t) => t.id === selectedTaskForAction);
//               if (task) {
//                 setEditingTask(task);
//                 setEditTaskText(task.text);
//                 setShowActionMenu(false);
//                 setShowEditModal(true);
//               }
//             }}
//           >
//             <View style={styles.actionMenuIcon}>
//               <Ionicons
//                 name="create-outline"
//                 size={24}
//                 color={Colors.primary}
//               />
//             </View>
//             <View style={styles.actionMenuInfo}>
//               <Text style={styles.actionMenuItemTitle}>Edit Task</Text>
//               <Text style={styles.actionMenuItemDesc}>
//                 Modify task description
//               </Text>
//             </View>
//             <Ionicons
//               name="chevron-forward"
//               size={20}
//               color={Colors.textLight}
//             />
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={styles.actionMenuItem}
//             onPress={() => {
//               setShowActionMenu(false);
//               if (selectedTaskForAction) {
//                 handleDeleteTask(selectedTaskForAction);
//               }
//             }}
//           >
//             <View style={[styles.actionMenuIcon, styles.actionMenuIconDanger]}>
//               <Ionicons name="trash-outline" size={24} color="#FF6B6B" />
//             </View>
//             <View style={styles.actionMenuInfo}>
//               <Text style={[styles.actionMenuItemTitle, styles.dangerText]}>
//                 Delete Task
//               </Text>
//               <Text style={styles.actionMenuItemDesc}>
//                 Remove task permanently
//               </Text>
//             </View>
//             <Ionicons name="chevron-forward" size={20} color="#FF6B6B" />
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={styles.actionMenuCancelBtn}
//             onPress={() => {
//               setShowActionMenu(false);
//               setSelectedTaskForAction(null);
//             }}
//           >
//             <Text style={styles.actionMenuCancelText}>Cancel</Text>
//           </TouchableOpacity>
//         </View>
//       </TouchableOpacity>
//     </Modal>
//   );
// };

// export default actionMenu;

// const styles = StyleSheet.create({
//   actionMenuOverlay: {
//     flex: 1,
//     backgroundColor: "rgba(0,0,0,0.5)",
//     justifyContent: "flex-end",
//     padding: 20,
//   },
//   actionMenuContent: {
//     backgroundColor: "white",
//     borderRadius: 24,
//     padding: 20,
//     gap: 10,
//   },
//   actionMenuHeader: {
//     paddingBottom: 10,
//     borderBottomWidth: 1,
//     borderBottomColor: Colors.background,
//     marginBottom: 5,
//   },
//   actionMenuTitle: {
//     fontSize: 18,
//     fontWeight: "700",
//     color: Colors.textDark,
//     textAlign: "center",
//   },

//   actionMenuItem: {
//     flexDirection: "row",
//     alignItems: "center",
//     padding: 16,
//     backgroundColor: Colors.background,
//     borderRadius: 16,
//     gap: 12,
//   },
//   actionMenuIcon: {
//     width: 48,
//     height: 48,
//     borderRadius: 24,
//     backgroundColor: "rgba(79, 195, 247, 0.1)",
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   actionMenuIconDanger: {
//     backgroundColor: "rgba(255, 107, 107, 0.1)",
//   },
//   actionMenuInfo: {
//     flex: 1,
//   },
//   actionMenuItemTitle: {
//     fontSize: 16,
//     fontWeight: "600",
//     color: Colors.textDark,
//     marginBottom: 2,
//   },
//   actionMenuItemDesc: {
//     fontSize: 13,
//     color: Colors.textLight,
//   },
// });
